from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models import InstagramAccount

AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize"
SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
LONG_TOKEN_URL = "https://graph.instagram.com/access_token"
PROFILE_URL = "https://graph.instagram.com/me"

# instagram_business_basic: perfil básico. instagram_business_manage_insights:
# necesario para la fase de métricas/calendario que viene después de conectar.
SCOPES = "instagram_business_basic,instagram_business_manage_insights"

_STATE_PURPOSE = "instagram_oauth"


class InstagramNoConfigurado(RuntimeError):
    pass


class StateInvalido(ValueError):
    pass


class InstagramAPIError(RuntimeError):
    pass


def _verificar_configurado() -> None:
    if not settings.instagram_app_id or not settings.instagram_app_secret:
        raise InstagramNoConfigurado(
            "Instagram no está configurado (falta INSTAGRAM_APP_ID o INSTAGRAM_APP_SECRET)"
        )


def crear_state(business_id: int) -> str:
    """El redirect_uri de Meta es fijo (no acepta el business_id en la URL),
    así que viaja firmado en el state para que el callback sepa a qué negocio
    conectar y para que no lo pueda falsificar quien intercepte el redirect."""
    payload = {
        "business_id": business_id,
        "purpose": _STATE_PURPOSE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decodificar_state(state: str) -> int:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != _STATE_PURPOSE:
            raise StateInvalido("state inválido")
        return int(payload["business_id"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise StateInvalido("state inválido o expirado") from exc


def construir_url_autorizacion(business_id: int) -> str:
    _verificar_configurado()
    params = {
        "client_id": settings.instagram_app_id,
        "redirect_uri": settings.instagram_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": crear_state(business_id),
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def intercambiar_code_por_token(code: str) -> str:
    """Devuelve el access token de corta duración (1 hora)."""
    _verificar_configurado()
    respuesta = requests.post(
        SHORT_TOKEN_URL,
        data={
            "client_id": settings.instagram_app_id,
            "client_secret": settings.instagram_app_secret,
            "grant_type": "authorization_code",
            "redirect_uri": settings.instagram_redirect_uri,
            "code": code,
        },
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"Meta rechazó el code de autorización: {respuesta.text}")
    return respuesta.json()["access_token"]


def obtener_token_larga_duracion(short_token: str) -> tuple[str, datetime]:
    """Cambia el token de 1 hora por uno de 60 días. Devuelve (token, expira_en_utc)."""
    _verificar_configurado()
    respuesta = requests.get(
        LONG_TOKEN_URL,
        params={
            "grant_type": "ig_exchange_token",
            "client_secret": settings.instagram_app_secret,
            "access_token": short_token,
        },
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudo obtener el token de larga duración: {respuesta.text}")
    data = respuesta.json()
    expira = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=data["expires_in"])
    return data["access_token"], expira


def obtener_perfil(access_token: str) -> tuple[str, str]:
    """Devuelve (instagram_user_id, username) de la cuenta conectada."""
    respuesta = requests.get(
        PROFILE_URL,
        params={"fields": "id,username", "access_token": access_token},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise InstagramAPIError(f"no se pudo obtener el perfil de Instagram: {respuesta.text}")
    data = respuesta.json()
    return str(data["id"]), data["username"]


def conectar_cuenta(db: Session, business_id: int, code: str) -> InstagramAccount:
    """Corre el intercambio completo (code -> token corto -> token largo ->
    perfil) y deja la cuenta guardada (o actualizada) para el negocio."""
    short_token = intercambiar_code_por_token(code)
    access_token, expira = obtener_token_larga_duracion(short_token)
    instagram_user_id, username = obtener_perfil(access_token)

    cuenta = db.query(InstagramAccount).filter_by(business_id=business_id).one_or_none()
    if cuenta is None:
        cuenta = InstagramAccount(business_id=business_id)
        db.add(cuenta)
    cuenta.instagram_user_id = instagram_user_id
    cuenta.username = username
    cuenta.access_token = access_token
    cuenta.token_expires_at = expira
    return cuenta
