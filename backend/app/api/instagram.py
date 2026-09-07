from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.models import Business, InstagramAccount, InstagramDailyMetric
from app.schemas.instagram import (
    InstagramAccountRead,
    InstagramConnectURL,
    InstagramDailyMetricRead,
    InstagramPatronRead,
)
from app.services.instagram import (
    InstagramAPIError,
    InstagramNoConfigurado,
    StateInvalido,
    conectar_cuenta,
    construir_url_autorizacion,
    decodificar_state,
)
from app.services.instagram_metrics import sincronizar_metricas
from app.services.instagram_posts import obtener_patrones_por_tipo, sincronizar_publicaciones

router = APIRouter(tags=["instagram"])

# El scheme registrado en app.json del frontend Expo — el callback (que
# corre en el navegador del OS, no dentro de la app) termina redirigiendo
# acá para que la app retome el control con el resultado.
APP_REDIRECT_URL = "elasesor://instagram-connected"


def _redirect_a_app(status: str, **params: str) -> RedirectResponse:
    query = urlencode({"status": status, **params})
    return RedirectResponse(url=f"{APP_REDIRECT_URL}?{query}")


@router.get("/businesses/{business_id}/instagram/connect", response_model=InstagramConnectURL)
def conectar_instagram(negocio: Business = Depends(get_owned_business)) -> InstagramConnectURL:
    try:
        url = construir_url_autorizacion(negocio.id)
    except InstagramNoConfigurado as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return InstagramConnectURL(url=url)


def _obtener_cuenta_o_404(negocio: Business, db: Session) -> InstagramAccount:
    cuenta = db.query(InstagramAccount).filter_by(business_id=negocio.id).one_or_none()
    if cuenta is None:
        raise HTTPException(status_code=404, detail="Este negocio no tiene Instagram conectado")
    return cuenta


@router.get("/businesses/{business_id}/instagram", response_model=InstagramAccountRead)
def obtener_cuenta_instagram(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> InstagramAccount:
    return _obtener_cuenta_o_404(negocio, db)


@router.delete("/businesses/{business_id}/instagram", status_code=204)
def desconectar_instagram(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> None:
    db.query(InstagramAccount).filter_by(business_id=negocio.id).delete()
    db.commit()


@router.post("/businesses/{business_id}/instagram/sync", response_model=InstagramDailyMetricRead)
def sincronizar_instagram(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> InstagramDailyMetric:
    cuenta = _obtener_cuenta_o_404(negocio, db)
    try:
        metrica = sincronizar_metricas(db, cuenta)
        sincronizar_publicaciones(db, cuenta)
    except InstagramAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.commit()
    db.refresh(metrica)
    return metrica


@router.get("/businesses/{business_id}/instagram/metrics", response_model=list[InstagramDailyMetricRead])
def listar_metricas_instagram(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> list[InstagramDailyMetric]:
    _obtener_cuenta_o_404(negocio, db)
    return (
        db.query(InstagramDailyMetric)
        .filter_by(business_id=negocio.id)
        .order_by(InstagramDailyMetric.fecha.desc())
        .limit(7)
        .all()
    )


@router.get("/businesses/{business_id}/instagram/patterns", response_model=list[InstagramPatronRead])
def patrones_instagram(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> list[dict]:
    _obtener_cuenta_o_404(negocio, db)
    return obtener_patrones_por_tipo(db, negocio.id)


@router.get("/integrations/instagram/callback")
def instagram_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Redirect_uri fijo registrado en el dashboard de Meta — recibe a TODOS
    los negocios, el business_id viaja en `state` (ver crear_state). Corre en
    el navegador del sistema, así que en vez de responder JSON siempre
    termina redirigiendo de vuelta a la app (ver APP_REDIRECT_URL) para que
    expo-web-browser cierre la sesión de auth y le devuelva el control."""
    if error:
        return _redirect_a_app("error", mensaje="Instagram rechazó la conexión")
    if not code or not state:
        return _redirect_a_app("error", mensaje="Faltan parámetros de Instagram")

    try:
        business_id = decodificar_state(state)
    except StateInvalido:
        return _redirect_a_app("error", mensaje="El enlace expiró, intenta de nuevo")

    if db.get(Business, business_id) is None:
        return _redirect_a_app("error", mensaje="Negocio no encontrado")

    try:
        cuenta = conectar_cuenta(db, business_id, code)
    except InstagramAPIError:
        return _redirect_a_app("error", mensaje="No se pudo conectar con Instagram")
    db.commit()
    db.refresh(cuenta)
    return _redirect_a_app("ok", username=cuenta.username)
