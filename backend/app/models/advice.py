from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Date, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class Veredicto(enum.StrEnum):
    RESURTE = "RESURTE"
    NO_PIDAS = "NO_PIDAS"
    VIGILA = "VIGILA"


class Confianza(enum.StrEnum):
    ALTA = "ALTA"
    BAJA = "BAJA"


class Advice(Base):
    __tablename__ = "advice"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"))
    veredicto: Mapped[Veredicto] = mapped_column(Enum(Veredicto, name="veredicto"))
    confianza: Mapped[Confianza] = mapped_column(Enum(Confianza, name="confianza"))
    texto: Mapped[str] = mapped_column(Text)
    datos_que_lo_respaldan: Mapped[dict] = mapped_column(JSONB, default=dict)
    fecha: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
