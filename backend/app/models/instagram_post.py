from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class InstagramPost(Base):
    """Una publicación de Instagram con sus métricas propias — para comparar
    rendimiento por tipo (foto/video/carrusel), no solo el total del día."""

    __tablename__ = "instagram_post"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    media_id: Mapped[str] = mapped_column(String(64), unique=True)
    media_type: Mapped[str] = mapped_column(String(32))
    publicado_en: Mapped[datetime] = mapped_column(DateTime)
    reach: Mapped[int] = mapped_column(default=0)
    likes: Mapped[int] = mapped_column(default=0)
    comments: Mapped[int] = mapped_column(default=0)
    saved: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
