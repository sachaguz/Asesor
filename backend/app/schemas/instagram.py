from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class InstagramConnectURL(BaseModel):
    url: str


class InstagramAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    connected_at: datetime
    token_expires_at: datetime
    racha_actual: int
    racha_maxima: int


class InstagramDailyMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fecha: date
    reach: int
    accounts_engaged: int
    views: int
    followers_count: int
    publico_contenido: bool


class InstagramPatronRead(BaseModel):
    media_type: str
    cantidad: int
    reach_promedio: int
    likes_promedio: int
    comments_promedio: int
    saved_promedio: int
