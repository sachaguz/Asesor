from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import ChatRole


class ChatMessageCreate(BaseModel):
    mensaje: str


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ChatRole
    contenido: str
    created_at: datetime
