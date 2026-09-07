from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.llm import get_cheap_llm_provider
from app.llm.base import LLMProvider
from app.models import Business, ChatMessage, ChatRole
from app.schemas.chat import ChatMessageCreate, ChatMessageRead
from app.services.chat import responder_mensaje

router = APIRouter(prefix="/businesses", tags=["chat"])

# El chat reenvía hasta 20 mensajes de historial en cada turno sin
# tool-calling (ver [[asesor-costos-ia]]) — es el punto de mayor riesgo de
# costo si un usuario se queda charlando. Tope conservador pensado para que
# el uso normal no lo note, cuidando el margen bajo una suscripción chica
# (~$4/mes).
_LIMITE_MENSAJES_DIARIOS = 15


@router.post("/{business_id}/chat", response_model=ChatMessageRead)
def enviar_mensaje(
    data: ChatMessageCreate,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_cheap_llm_provider),
) -> ChatMessage:
    enviados_hoy = (
        db.query(func.count(ChatMessage.id))
        .filter(ChatMessage.business_id == negocio.id)
        .filter(ChatMessage.role == ChatRole.USER)
        .filter(func.date(ChatMessage.created_at) == date.today())
        .scalar()
    )
    if enviados_hoy >= _LIMITE_MENSAJES_DIARIOS:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Llegaste al límite de {_LIMITE_MENSAJES_DIARIOS} mensajes de hoy. "
                "Mañana podés seguir charlando."
            ),
        )
    respuesta = responder_mensaje(db, negocio, data.mensaje, llm)
    db.commit()
    db.refresh(respuesta)
    return respuesta


@router.get("/{business_id}/chat", response_model=list[ChatMessageRead])
def listar_chat(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> list[ChatMessage]:
    return db.query(ChatMessage).filter_by(business_id=negocio.id).order_by(ChatMessage.created_at).all()
