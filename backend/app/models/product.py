from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Product(Base):
    __tablename__ = "product"
    __table_args__ = (UniqueConstraint("business_id", "nombre", name="uq_product_business_nombre"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    nombre: Mapped[str] = mapped_column(String(255))
    categoria: Mapped[str | None] = mapped_column(String(100), default=None)
    atributos: Mapped[dict] = mapped_column(JSONB, default=dict)
