from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GoogleDriveConnectURL(BaseModel):
    url: str


class GoogleDriveConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    folder_id: str | None
    folder_name: str | None
    connected_at: datetime
    last_synced_at: datetime | None


class GoogleDriveFolderCreate(BaseModel):
    """El usuario pega el link de la carpeta (o el ID a secas) tal como lo
    copia de Drive; el backend extrae el ID (ver extraer_folder_id)."""

    folder_url: str


class GoogleDriveSyncResultRead(BaseModel):
    archivos_importados: int
    filas_importadas: int
    errores: list[str]
