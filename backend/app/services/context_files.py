from __future__ import annotations

import uuid
from pathlib import Path

from app.config import settings


def guardar_archivo(business_id: int, nombre_original: str, contenido: bytes) -> str:
    """Guarda el archivo en disco local y devuelve la ruta guardada.

    Storage local de MVP, sin proveedor de nube decidido todavía (ver
    Settings.context_files_dir) — revisar antes de desplegar a Railway.
    """
    directorio = Path(settings.context_files_dir) / str(business_id)
    directorio.mkdir(parents=True, exist_ok=True)

    extension = Path(nombre_original).suffix
    nombre_guardado = f"{uuid.uuid4().hex}{extension}"
    ruta = directorio / nombre_guardado
    ruta.write_bytes(contenido)

    return str(ruta)
