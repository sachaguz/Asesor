from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BusinessCreate(BaseModel):
    nombre: str
    giro: str
    config: dict = {}


class BusinessRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    giro: str
    created_at: datetime
