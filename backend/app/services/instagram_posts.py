from __future__ import annotations

from datetime import datetime
from typing import Any

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import InstagramAccount, InstagramPost
from app.services.instagram import InstagramAPIError

MEDIA_URL = "https://graph.instagram.com/me/media"

# reach/likes/comments/saved: el subconjunto de métricas de post que la
# Graph API soporta igual para IMAGE, VIDEO y CAROUSEL_ALBUM (a diferencia de
# métricas exclusivas de Reels o Stories, que no aplican acá).
POST_METRICS = "reach,likes,comments,saved"


def obtener_publicaciones_recientes(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    respuesta = requests.get(
        MEDIA_URL,
        params={"fields": "id,media_type,timestamp", "limit": limit, "access_token": access_token},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudo obtener las publicaciones recientes: {respuesta.text}")
    return respuesta.json().get("data", [])


def obtener_insights_de_publicacion(media_id: str, access_token: str) -> dict[str, int]:
    """Si Instagram rechaza la consulta para esta publicación puntual (pasa
    con algunos formatos especiales, ej. reels con métricas propias), se
    devuelve vacío en vez de cortar la sincronización completa."""
    respuesta = requests.get(
        f"https://graph.instagram.com/{media_id}/insights",
        params={"metric": POST_METRICS, "access_token": access_token},
        timeout=10,
    )
    if respuesta.status_code != 200:
        return {}
    datos = respuesta.json().get("data", [])
    return {item["name"]: _extraer_valor(item) for item in datos}


def _extraer_valor(item: dict[str, Any]) -> int:
    if "total_value" in item:
        return item["total_value"].get("value", 0)
    valores = item.get("values", [])
    if valores:
        return valores[-1].get("value", 0)
    return 0


def sincronizar_publicaciones(db: Session, cuenta: InstagramAccount) -> None:
    publicaciones = obtener_publicaciones_recientes(cuenta.access_token)
    for item in publicaciones:
        insights = obtener_insights_de_publicacion(item["id"], cuenta.access_token)

        post = db.query(InstagramPost).filter_by(media_id=item["id"]).one_or_none()
        if post is None:
            post = InstagramPost(
                business_id=cuenta.business_id, media_id=item["id"], reach=0, likes=0, comments=0, saved=0
            )
            db.add(post)
        post.media_type = item["media_type"]
        post.publicado_en = datetime.fromisoformat(item["timestamp"])
        # Si Instagram no devolvió alguna métrica esta vez, se deja el valor
        # que ya había en vez de pisarlo con 0.
        for metrica in ("reach", "likes", "comments", "saved"):
            if metrica in insights:
                setattr(post, metrica, insights[metrica])


def obtener_patrones_por_tipo(db: Session, business_id: int) -> list[dict[str, Any]]:
    filas = (
        db.query(
            InstagramPost.media_type,
            func.count(InstagramPost.id),
            func.avg(InstagramPost.reach),
            func.avg(InstagramPost.likes),
            func.avg(InstagramPost.comments),
            func.avg(InstagramPost.saved),
        )
        .filter_by(business_id=business_id)
        .group_by(InstagramPost.media_type)
        .all()
    )
    return [
        {
            "media_type": media_type,
            "cantidad": cantidad,
            "reach_promedio": round(reach or 0),
            "likes_promedio": round(likes or 0),
            "comments_promedio": round(comments or 0),
            "saved_promedio": round(saved or 0),
        }
        for media_type, cantidad, reach, likes, comments, saved in filas
    ]
