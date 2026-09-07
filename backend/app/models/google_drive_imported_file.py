from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class GoogleDriveImportedFile(Base):
    """Registro de qué archivos de Drive ya se importaron, para que un
    sync repetido no vuelva a cargar las mismas ventas (ver decisión de la
    fase: no se reimporta un archivo editado, solo los que son nuevos)."""

    __tablename__ = "google_drive_imported_file"
    __table_args__ = (UniqueConstraint("connection_id", "drive_file_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("google_drive_connection.id", ondelete="CASCADE")
    )
    drive_file_id: Mapped[str] = mapped_column(String(128))
    nombre_archivo: Mapped[str] = mapped_column(String(255))
    filas_importadas: Mapped[int] = mapped_column(default=0)
    imported_at: Mapped[datetime] = mapped_column(server_default=func.now())
