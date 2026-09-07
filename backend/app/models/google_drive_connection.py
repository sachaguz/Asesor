from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class GoogleDriveConnection(Base):
    __tablename__ = "google_drive_connection"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("business.id", ondelete="CASCADE"), unique=True
    )
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    token_expires_at: Mapped[datetime] = mapped_column()
    # folder_id/folder_name quedan en None hasta que el usuario pega el link
    # de la carpeta (paso separado de la conexión OAuth, ver
    # POST /businesses/{id}/google-drive/folder).
    folder_id: Mapped[str | None] = mapped_column(String(128), default=None)
    folder_name: Mapped[str | None] = mapped_column(String(255), default=None)
    connected_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_synced_at: Mapped[datetime | None] = mapped_column(default=None)
