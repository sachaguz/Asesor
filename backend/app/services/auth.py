from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from google.auth.exceptions import TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings


class TokenInvalido(ValueError):
    pass


class GoogleNoDisponible(RuntimeError):
    """Error de red al contactar a Google (no del token en sí) — se
    reintenta unas veces antes de darse por vencido."""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"sub": str(user_id), "exp": expira}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise TokenInvalido("token inválido o expirado") from exc


def _crear_token_de_proposito(user_id: int, proposito: str, minutos: int) -> str:
    payload = {
        "sub": str(user_id),
        "purpose": proposito,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutos),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decodificar_token_de_proposito(token: str, proposito: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != proposito:
            raise TokenInvalido("token inválido")
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise TokenInvalido("token inválido o expirado") from exc


def crear_token_verificacion(user_id: int) -> str:
    return _crear_token_de_proposito(user_id, "verify_email", minutos=60 * 24)


def decodificar_token_verificacion(token: str) -> int:
    return _decodificar_token_de_proposito(token, "verify_email")


def crear_token_reset_password(user_id: int) -> str:
    return _crear_token_de_proposito(user_id, "reset_password", minutos=60)


def decodificar_token_reset_password(token: str) -> int:
    return _decodificar_token_de_proposito(token, "reset_password")


def verificar_id_token_google(token: str) -> dict[str, Any]:
    """Valida firma, emisor y audiencia contra los certificados públicos de
    Google — el mismo id_token que ya verificó el navegador al loguear."""
    if not settings.google_client_id:
        raise TokenInvalido("login con Google no configurado")

    ultimo_error: Exception | None = None
    for intento in range(3):
        try:
            return google_id_token.verify_oauth2_token(
                token, google_requests.Request(), audience=settings.google_client_id
            )
        except ValueError as exc:
            raise TokenInvalido("token de Google inválido") from exc
        except TransportError as exc:
            ultimo_error = exc
            if intento < 2:
                time.sleep(0.6)
    raise GoogleNoDisponible("no se pudo contactar a Google") from ultimo_error
