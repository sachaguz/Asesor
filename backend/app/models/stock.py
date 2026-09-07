from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Stock(Base):
    __tablename__ = "stock"

    variant_id: Mapped[int] = mapped_column(ForeignKey("variant.id", ondelete="CASCADE"), primary_key=True)
    cantidad_actual: Mapped[int] = mapped_column(default=0)
