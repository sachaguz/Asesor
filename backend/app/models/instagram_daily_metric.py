from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class InstagramDailyMetric(Base):
    __tablename__ = "instagram_daily_metric"
    __table_args__ = (UniqueConstraint("business_id", "fecha"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    fecha: Mapped[date] = mapped_column(Date)
    reach: Mapped[int] = mapped_column(default=0)
    accounts_engaged: Mapped[int] = mapped_column(default=0)
    views: Mapped[int] = mapped_column(default=0)
    followers_count: Mapped[int] = mapped_column(default=0)
    publico_contenido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
