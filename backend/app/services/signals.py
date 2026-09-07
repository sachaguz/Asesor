from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.models import Sale, Variant


@dataclass
class ProductSignals:
    total_variantes: int
    variantes_con_venta: int
    unidades_vendidas: int
    dias_desde_ultima_venta: int | None
    velocidad_venta: float  # unidades por día, sobre el período con datos

    @property
    def pct_variantes_vendidas(self) -> float:
        if self.total_variantes == 0:
            return 0.0
        return self.variantes_con_venta / self.total_variantes


def calcular_señales(db: Session, product_id: int, hoy: date | None = None) -> ProductSignals:
    """Calcula señales de venta para un producto, sin aplicar ninguna regla de giro."""
    hoy = hoy or date.today()

    total_variantes = db.query(Variant).filter_by(product_id=product_id).count()

    ventas = (
        db.query(Sale)
        .join(Variant, Sale.variant_id == Variant.id)
        .filter(Variant.product_id == product_id)
        .all()
    )

    if not ventas:
        return ProductSignals(
            total_variantes=total_variantes,
            variantes_con_venta=0,
            unidades_vendidas=0,
            dias_desde_ultima_venta=None,
            velocidad_venta=0.0,
        )

    variantes_con_venta = len({venta.variant_id for venta in ventas})
    unidades_vendidas = sum(venta.cantidad for venta in ventas)
    primera_venta = min(venta.fecha for venta in ventas)
    ultima_venta = max(venta.fecha for venta in ventas)
    dias_desde_ultima_venta = (hoy - ultima_venta).days
    dias_con_datos = max((ultima_venta - primera_venta).days, 1)

    return ProductSignals(
        total_variantes=total_variantes,
        variantes_con_venta=variantes_con_venta,
        unidades_vendidas=unidades_vendidas,
        dias_desde_ultima_venta=dias_desde_ultima_venta,
        velocidad_venta=unidades_vendidas / dias_con_datos,
    )
