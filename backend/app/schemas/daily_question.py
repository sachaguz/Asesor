from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class AnswerCreate(BaseModel):
    respuesta: str


class DailyQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pregunta: str
    respuesta: str | None
    fecha_pregunta: date
    fecha_respuesta: date | None
    created_at: datetime
