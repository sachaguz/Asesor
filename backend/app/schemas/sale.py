from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    variant_id: int
    fecha: date
    cantidad: int
    precio: Decimal
    created_at: datetime


class ImportResultRead(BaseModel):
    filas_importadas: int
    errores: list[str]


class ResumenVentasRead(BaseModel):
    """`fecha` es la del último día con ventas registradas, no necesariamente
    ayer — el usuario no tiene por qué importar ventas todos los días. `None`
    si el negocio todavía no tiene ninguna venta cargada."""

    fecha: date | None
    monto: Decimal
    unidades: int
