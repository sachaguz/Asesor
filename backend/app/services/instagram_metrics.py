from __future__ import annotations

from datetime import date, datetime, timedelta

import requests
from sqlalchemy.orm import Session

from app.models import InstagramAccount, InstagramDailyMetric
from app.services.instagram import InstagramAPIError

MEDIA_URL = "https://graph.instagram.com/me/media"
PROFILE_URL = "https://graph.instagram.com/me"
INSIGHTS_METRICS = "reach,accounts_engaged,views"

# Metrics de período "day" en la Graph API de Instagram — impressions y
# profile_views quedaron deprecadas en v22.0, se reemplazan por estas.


def obtener_metricas_insights(instagram_user_id: str, access_token: str) -> dict[str, int]:
    respuesta = requests.get(
        f"https://graph.instagram.com/{instagram_user_id}/insights",
        params={
            "metric": INSIGHTS_METRICS,
            "period": "day",
            "metric_type": "total_value",
            "access_token": access_token,
        },
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudieron obtener los insights: {respuesta.text}")
    datos = respuesta.json().get("data", [])
    return {item["name"]: item.get("total_value", {}).get("value", 0) for item in datos}


def obtener_conteo_seguidores(access_token: str) -> int:
    respuesta = requests.get(
        PROFILE_URL,
        params={"fields": "followers_count", "access_token": access_token},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudo obtener el perfil de Instagram: {respuesta.text}")
    return respuesta.json().get("followers_count", 0)


def publico_contenido_hoy(access_token: str, hoy: date) -> bool:
    respuesta = requests.get(
        MEDIA_URL,
        params={"fields": "id,timestamp", "limit": 25, "access_token": access_token},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudo obtener las publicaciones recientes: {respuesta.text}")
    for item in respuesta.json().get("data", []):
        publicado_en = datetime.fromisoformat(item["timestamp"]).date()
        if publicado_en == hoy:
            return True
    return False


def _actualizar_racha(cuenta: InstagramAccount, hoy: date, publico_hoy: bool) -> None:
    """Racha estilo Duolingo: sube un día seguido de publicar, se corta apenas
    se salta un día entero sin hacerlo."""
    if publico_hoy:
        if cuenta.ultima_fecha_publicacion == hoy - timedelta(days=1):
            cuenta.racha_actual += 1
        elif cuenta.ultima_fecha_publicacion != hoy:
            cuenta.racha_actual = 1
        cuenta.ultima_fecha_publicacion = hoy
        cuenta.racha_maxima = max(cuenta.racha_maxima, cuenta.racha_actual)
    elif cuenta.ultima_fecha_publicacion is not None and cuenta.ultima_fecha_publicacion < hoy - timedelta(
        days=1
    ):
        cuenta.racha_actual = 0


def sincronizar_metricas(db: Session, cuenta: InstagramAccount) -> InstagramDailyMetric:
    hoy = date.today()
    insights = obtener_metricas_insights(cuenta.instagram_user_id, cuenta.access_token)
    followers_count = obtener_conteo_seguidores(cuenta.access_token)
    publico_hoy = publico_contenido_hoy(cuenta.access_token, hoy)

    _actualizar_racha(cuenta, hoy, publico_hoy)

    metrica = db.query(InstagramDailyMetric).filter_by(business_id=cuenta.business_id, fecha=hoy).one_or_none()
    if metrica is None:
        metrica = InstagramDailyMetric(business_id=cuenta.business_id, fecha=hoy)
        db.add(metrica)
    metrica.reach = insights.get("reach", 0)
    metrica.accounts_engaged = insights.get("accounts_engaged", 0)
    metrica.views = insights.get("views", 0)
    metrica.followers_count = followers_count
    metrica.publico_contenido = publico_hoy
    return metrica
