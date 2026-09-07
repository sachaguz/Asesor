from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.models import GoogleDriveConnection, GoogleDriveImportedFile

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
FILES_URL = "https://www.googleapis.com/drive/v3/files"

# drive.readonly (no drive.file): más simple para esta fase porque no exige
# embeber el widget Picker de Google para elegir carpeta — el usuario pega el
# link de la carpeta a mano (ver extraer_folder_id). Ver decisión de la fase.
SCOPES = "https://www.googleapis.com/auth/drive.readonly"

_STATE_PURPOSE = "google_drive_oauth"
_FOLDER_ID_RE = re.compile(r"/folders/([a-zA-Z0-9_-]+)")


class GoogleDriveNoConfigurado(RuntimeError):
    pass


class StateInvalido(ValueError):
    pass


class GoogleDriveAPIError(RuntimeError):
    pass


class FolderInvalido(ValueError):
    pass


def _verificar_configurado() -> None:
    if not settings.google_drive_client_id or not settings.google_drive_client_secret:
        raise GoogleDriveNoConfigurado(
            "Google Drive no está configurado (falta GOOGLE_DRIVE_CLIENT_ID o "
            "GOOGLE_DRIVE_CLIENT_SECRET)"
        )


def crear_state(business_id: int) -> str:
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
        "client_id": settings.google_drive_client_id,
        "redirect_uri": settings.google_drive_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": crear_state(business_id),
        # access_type=offline es lo que hace que Google devuelva
        # refresh_token; prompt=consent lo fuerza también en una reconexión
        # (si no, Google solo lo manda la primera vez que el usuario autoriza).
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def intercambiar_code_por_tokens(code: str) -> tuple[str, str, datetime]:
    """Devuelve (access_token, refresh_token, expira_en_utc)."""
    _verificar_configurado()
    respuesta = requests.post(
        TOKEN_URL,
        data={
            "client_id": settings.google_drive_client_id,
            "client_secret": settings.google_drive_client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": settings.google_drive_redirect_uri,
            "code": code,
        },
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise GoogleDriveAPIError(f"Google rechazó el code de autorización: {respuesta.text}")
    data = respuesta.json()
    if "refresh_token" not in data:
        raise GoogleDriveAPIError(
            "Google no devolvió refresh_token (revocá el acceso de la app en "
            "myaccount.google.com/permissions e intentá conectar de nuevo)"
        )
    expira = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=data["expires_in"])
    return data["access_token"], data["refresh_token"], expira


def _refrescar_access_token(refresh_token: str) -> tuple[str, datetime]:
    _verificar_configurado()
    respuesta = requests.post(
        TOKEN_URL,
        data={
            "client_id": settings.google_drive_client_id,
            "client_secret": settings.google_drive_client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise GoogleDriveAPIError(f"no se pudo refrescar el token de Google: {respuesta.text}")
    data = respuesta.json()
    expira = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=data["expires_in"])
    return data["access_token"], expira


def asegurar_token_vigente(db: Session, conexion: GoogleDriveConnection) -> str:
    """Refresca el access_token si ya venció (dura 1 hora) y persiste el
    cambio. Devuelve el access_token vigente para usar contra la Drive API."""
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    if conexion.token_expires_at > ahora:
        return conexion.access_token

    access_token, expira = _refrescar_access_token(conexion.refresh_token)
    conexion.access_token = access_token
    conexion.token_expires_at = expira
    db.flush()
    return access_token


def extraer_folder_id(folder_url: str) -> str:
    """Acepta tanto un link completo de Drive como el ID pegado a secas."""
    folder_url = folder_url.strip()
    match = _FOLDER_ID_RE.search(folder_url)
    if match:
        return match.group(1)
    if "/" in folder_url or "?" in folder_url:
        raise FolderInvalido("No pude reconocer el link de la carpeta de Drive.")
    return folder_url


def obtener_nombre_carpeta(access_token: str, folder_id: str) -> str:
    respuesta = requests.get(
        f"{FILES_URL}/{folder_id}",
        params={"fields": "id,name,mimeType", "supportsAllDrives": "true"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise FolderInvalido("No encontré esa carpeta en tu Google Drive.")
    data = respuesta.json()
    if data.get("mimeType") != "application/vnd.google-apps.folder":
        raise FolderInvalido("Ese link no es de una carpeta de Google Drive.")
    return data["name"]


def listar_csvs_nuevos(db: Session, conexion: GoogleDriveConnection) -> list[dict]:
    """Archivos .csv de la carpeta conectada que todavía no se importaron."""
    access_token = asegurar_token_vigente(db, conexion)
    respuesta = requests.get(
        FILES_URL,
        params={
            "q": f"'{conexion.folder_id}' in parents and trashed = false",
            "fields": "files(id,name,mimeType)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        },
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if respuesta.status_code != 200:
        raise GoogleDriveAPIError(f"no se pudo listar la carpeta de Drive: {respuesta.text}")

    ya_importados = {
        fila.drive_file_id
        for fila in db.query(GoogleDriveImportedFile.drive_file_id)
        .filter_by(connection_id=conexion.id)
        .all()
    }
    archivos = respuesta.json().get("files", [])
    return [
        archivo
        for archivo in archivos
        if archivo["name"].lower().endswith(".csv") and archivo["id"] not in ya_importados
    ]


def descargar_archivo(db: Session, conexion: GoogleDriveConnection, file_id: str) -> str:
    access_token = asegurar_token_vigente(db, conexion)
    respuesta = requests.get(
        f"{FILES_URL}/{file_id}",
        params={"alt": "media"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    if respuesta.status_code != 200:
        raise GoogleDriveAPIError(f"no se pudo descargar el archivo de Drive: {respuesta.text}")
    return respuesta.content.decode("utf-8-sig")
