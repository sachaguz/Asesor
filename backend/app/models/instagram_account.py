from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class InstagramAccount(Base):
    __tablename__ = "instagram_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"), unique=True)
    instagram_user_id: Mapped[str] = mapped_column(String(64))
    username: Mapped[str] = mapped_column(String(255))
    access_token: Mapped[str] = mapped_column(Text)
    token_expires_at: Mapped[datetime] = mapped_column(DateTime)
    connected_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Racha estilo Duolingo: sube cuando hay una publicación nueva ese día,
    # se corta apenas se salta un día entero sin publicar.
    racha_actual: Mapped[int] = mapped_column(default=0)
    racha_maxima: Mapped[int] = mapped_column(default=0)
    ultima_fecha_publicacion: Mapped[date | None] = mapped_column(Date, default=None)
