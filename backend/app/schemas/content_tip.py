from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ContentTipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    texto: str
    fecha: date
    created_at: datetime
