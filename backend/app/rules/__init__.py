from app.rules.base import Evaluacion, GiroRules
from app.rules.genericas import UMBRAL_DIAS_SIN_VENTA_DEFAULT, ReglasGenericas

# Registro de reglas específicas por giro. Vacío por diseño: ningún giro
# tiene todavía reglas de negocio validadas por un experto en el código
# (ver decisión de arquitectura de El Asesor), así que todo giro cae en el
# fallback genérico.
_REGLAS_POR_GIRO: dict[str, GiroRules] = {}


def reglas_para_giro(
    giro: str, *, umbral_dias_sin_venta: int = UMBRAL_DIAS_SIN_VENTA_DEFAULT
) -> GiroRules:
    if giro in _REGLAS_POR_GIRO:
        return _REGLAS_POR_GIRO[giro]
    return ReglasGenericas(umbral_dias_sin_venta=umbral_dias_sin_venta)


__all__ = [
    "Evaluacion",
    "GiroRules",
    "ReglasGenericas",
    "reglas_para_giro",
]
