from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ContentTip(Base):
    """Idea de contenido para redes sociales, una por negocio por día."""

    __tablename__ = "content_tip"
    __table_args__ = (UniqueConstraint("business_id", "fecha"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    texto: Mapped[str] = mapped_column(Text)
    fecha: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
