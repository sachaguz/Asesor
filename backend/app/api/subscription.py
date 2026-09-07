from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.subscription import PaymentSheetParams, SubscriptionEstado
from app.services.subscription import (
    SubscriptionAPIError,
    SubscriptionNoConfigurada,
    aplicar_evento_webhook,
    crear_intento_de_suscripcion,
)

router = APIRouter(prefix="/subscription", tags=["subscription"])


@router.get("/estado", response_model=SubscriptionEstado)
def estado_suscripcion(current_user: User = Depends(get_current_user)) -> SubscriptionEstado:
    return SubscriptionEstado(suscrito=current_user.suscripcion_redes_activa)


@router.post("/payment-sheet", response_model=PaymentSheetParams)
def crear_payment_sheet(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PaymentSheetParams:
    try:
        client_secret, ephemeral_key_secret, customer_id = crear_intento_de_suscripcion(current_user)
    except SubscriptionNoConfigurada as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SubscriptionAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.commit()
    return PaymentSheetParams(
        payment_intent_client_secret=client_secret,
        ephemeral_key_secret=ephemeral_key_secret,
        customer_id=customer_id,
    )


@router.post("/webhook")
async def webhook_stripe(request: Request, db: Session = Depends(get_db)) -> dict[str, bool]:
    """Endpoint público (sin auth) que llama Stripe directamente — la firma
    en Stripe-Signature es lo que garantiza que el request es legítimo."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        aplicar_evento_webhook(db, payload, sig_header)
    except SubscriptionNoConfigurada as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SubscriptionAPIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    return {"received": True}
