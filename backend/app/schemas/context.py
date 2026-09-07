from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContextTextCreate(BaseModel):
    texto: str


class BusinessContextRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    texto: str | None
    archivo_path: str | None
    created_at: datetime
