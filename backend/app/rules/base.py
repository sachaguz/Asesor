from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models import Confianza, Veredicto
from app.services.signals import ProductSignals


@dataclass
class Evaluacion:
    veredicto: Veredicto
    confianza: Confianza
    texto: str
    datos: dict


class GiroRules(ABC):
    """Reglas de negocio que convierten señales en un veredicto.

    Pieza intercambiable por giro (principio 4 del briefing): hoy solo
    existe una implementación genérica, sin conocimiento de ningún giro
    específico (ver decisión de arquitectura de El Asesor).
    """

    @abstractmethod
    def evaluar(self, producto_nombre: str, señales: ProductSignals) -> Evaluacion: ...
