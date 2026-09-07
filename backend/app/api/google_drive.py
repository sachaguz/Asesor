from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.llm import get_llm_provider
from app.llm.base import LLMProvider
from app.models import Business, GoogleDriveConnection
from app.schemas.google_drive import (
    GoogleDriveConnectionRead,
    GoogleDriveConnectURL,
    GoogleDriveFolderCreate,
    GoogleDriveSyncResultRead,
)
from app.services.google_drive import (
    FolderInvalido,
    GoogleDriveAPIError,
    GoogleDriveNoConfigurado,
    StateInvalido,
    asegurar_token_vigente,
    construir_url_autorizacion,
    decodificar_state,
    extraer_folder_id,
    intercambiar_code_por_tokens,
    obtener_nombre_carpeta,
)
from app.services.google_drive_importer import sincronizar_carpeta

router = APIRouter(tags=["google-drive"])

# Igual patrón que Instagram (ver app/api/instagram.py): el callback corre en
# el navegador del sistema y siempre termina redirigiendo a la app.
APP_REDIRECT_URL = "elasesor://google-drive-connected"


def _redirect_a_app(status: str, **params: str) -> RedirectResponse:
    query = urlencode({"status": status, **params})
    return RedirectResponse(url=f"{APP_REDIRECT_URL}?{query}")


@router.get("/businesses/{business_id}/google-drive/connect", response_model=GoogleDriveConnectURL)
def conectar_google_drive(negocio: Business = Depends(get_owned_business)) -> GoogleDriveConnectURL:
    try:
        url = construir_url_autorizacion(negocio.id)
    except GoogleDriveNoConfigurado as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return GoogleDriveConnectURL(url=url)


def _obtener_conexion_o_404(negocio: Business, db: Session) -> GoogleDriveConnection:
    conexion = db.query(GoogleDriveConnection).filter_by(business_id=negocio.id).one_or_none()
    if conexion is None:
        raise HTTPException(status_code=404, detail="Este negocio no tiene Google Drive conectado")
    return conexion


@router.get("/businesses/{business_id}/google-drive", response_model=GoogleDriveConnectionRead)
def obtener_conexion_google_drive(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> GoogleDriveConnection:
    return _obtener_conexion_o_404(negocio, db)


@router.delete("/businesses/{business_id}/google-drive", status_code=204)
def desconectar_google_drive(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> None:
    db.query(GoogleDriveConnection).filter_by(business_id=negocio.id).delete()
    db.commit()


@router.post("/businesses/{business_id}/google-drive/folder", response_model=GoogleDriveConnectionRead)
def elegir_carpeta_google_drive(
    data: GoogleDriveFolderCreate,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> GoogleDriveConnection:
    conexion = _obtener_conexion_o_404(negocio, db)
    try:
        folder_id = extraer_folder_id(data.folder_url)
        access_token = asegurar_token_vigente(db, conexion)
        folder_name = obtener_nombre_carpeta(access_token, folder_id)
    except (FolderInvalido, GoogleDriveAPIError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    conexion.folder_id = folder_id
    conexion.folder_name = folder_name
    db.commit()
    db.refresh(conexion)
    return conexion


@router.post("/businesses/{business_id}/google-drive/sync", response_model=GoogleDriveSyncResultRead)
def sincronizar_google_drive(
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_llm_provider),
) -> GoogleDriveSyncResultRead:
    conexion = _obtener_conexion_o_404(negocio, db)
    if conexion.folder_id is None:
        raise HTTPException(status_code=422, detail="Primero elegí una carpeta de Google Drive")

    try:
        resultado = sincronizar_carpeta(db, conexion, llm)
    except GoogleDriveAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    conexion.last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return GoogleDriveSyncResultRead(
        archivos_importados=resultado.archivos_importados,
        filas_importadas=resultado.filas_importadas,
        errores=resultado.errores,
    )


@router.get("/integrations/google-drive/callback")
def google_drive_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error:
        return _redirect_a_app("error", mensaje="Google rechazó la conexión")
    if not code or not state:
        return _redirect_a_app("error", mensaje="Faltan parámetros de Google")

    try:
        business_id = decodificar_state(state)
    except StateInvalido:
        return _redirect_a_app("error", mensaje="El enlace expiró, intenta de nuevo")

    if db.get(Business, business_id) is None:
        return _redirect_a_app("error", mensaje="Negocio no encontrado")

    try:
        access_token, refresh_token, expira = intercambiar_code_por_tokens(code)
    except GoogleDriveAPIError:
        return _redirect_a_app("error", mensaje="No se pudo conectar con Google Drive")

    conexion = db.query(GoogleDriveConnection).filter_by(business_id=business_id).one_or_none()
    if conexion is None:
        conexion = GoogleDriveConnection(business_id=business_id)
        db.add(conexion)
    conexion.access_token = access_token
    conexion.refresh_token = refresh_token
    conexion.token_expires_at = expira
    db.commit()
    return _redirect_a_app("ok")
