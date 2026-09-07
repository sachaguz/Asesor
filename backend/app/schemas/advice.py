from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models import Confianza, Veredicto


class AdviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    producto: str
    veredicto: Veredicto
    confianza: Confianza
    texto: str
    datos_que_lo_respaldan: dict
    fecha: date
    created_at: datetime
