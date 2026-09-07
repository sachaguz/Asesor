from __future__ import annotations

from pydantic import BaseModel


class SubscriptionEstado(BaseModel):
    suscrito: bool


class PaymentSheetParams(BaseModel):
    payment_intent_client_secret: str
    ephemeral_key_secret: str
    customer_id: str
