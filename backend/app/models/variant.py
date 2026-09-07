from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Variant(Base):
    __tablename__ = "variant"
    __table_args__ = (UniqueConstraint("product_id", "nombre", name="uq_variant_product_nombre"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"))
    nombre: Mapped[str] = mapped_column(String(255))
    atributos: Mapped[dict] = mapped_column(JSONB, default=dict)
