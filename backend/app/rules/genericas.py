from __future__ import annotations

from app.models import Confianza, Veredicto
from app.rules.base import Evaluacion, GiroRules
from app.services.signals import ProductSignals

UMBRAL_DIAS_SIN_VENTA_DEFAULT = 60


class ReglasGenericas(GiroRules):
    """Umbrales genéricos de señales, sin conocimiento de ningún giro.

    Toda evaluación se marca con confianza baja: ninguna regla de giro está
    validada todavía por un experto en el código.
    """

    def __init__(self, umbral_dias_sin_venta: int = UMBRAL_DIAS_SIN_VENTA_DEFAULT) -> None:
        self.umbral_dias_sin_venta = umbral_dias_sin_venta

    def evaluar(self, producto_nombre: str, señales: ProductSignals) -> Evaluacion:
        datos = {
            "unidades_vendidas": señales.unidades_vendidas,
            "dias_desde_ultima_venta": señales.dias_desde_ultima_venta,
            "pct_variantes_vendidas": round(señales.pct_variantes_vendidas, 2),
            "velocidad_venta": round(señales.velocidad_venta, 3),
        }

        if señales.dias_desde_ultima_venta is None:
            return Evaluacion(
                veredicto=Veredicto.VIGILA,
                confianza=Confianza.BAJA,
                texto=f"'{producto_nombre}' no tiene ventas registradas todavía; falta información para decidir.",
                datos=datos,
            )

        sin_movimiento = señales.dias_desde_ultima_venta > self.umbral_dias_sin_venta

        if sin_movimiento:
            return Evaluacion(
                veredicto=Veredicto.NO_PIDAS,
                confianza=Confianza.BAJA,
                texto=(
                    f"'{producto_nombre}' lleva {señales.dias_desde_ultima_venta} días sin venderse "
                    f"(se vendió el {señales.pct_variantes_vendidas:.0%} de sus variantes en total)."
                ),
                datos=datos,
            )

        if señales.velocidad_venta > 0:
            return Evaluacion(
                veredicto=Veredicto.RESURTE,
                confianza=Confianza.BAJA,
                texto=(
                    f"'{producto_nombre}' se sigue vendiendo (última venta hace "
                    f"{señales.dias_desde_ultima_venta} días); conviene resurtir."
                ),
                datos=datos,
            )

        return Evaluacion(
            veredicto=Veredicto.VIGILA,
            confianza=Confianza.BAJA,
            texto=f"'{producto_nombre}' no muestra una tendencia clara todavía; vigilar antes de decidir.",
            datos=datos,
        )
