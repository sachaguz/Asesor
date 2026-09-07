from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.llm import get_cheap_llm_provider
from app.llm.base import LLMProvider
from app.models import Business, DailyQuestion
from app.schemas.daily_question import AnswerCreate, DailyQuestionRead
from app.services.daily_question_generator import generar_pregunta_del_dia

router = APIRouter(prefix="/businesses", tags=["daily-question"])


@router.post("/{business_id}/daily-question/generate", response_model=DailyQuestionRead)
def generar_pregunta(
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_cheap_llm_provider),
) -> DailyQuestion:
    pregunta = generar_pregunta_del_dia(db, negocio, llm)
    db.commit()
    db.refresh(pregunta)
    return pregunta


@router.get("/{business_id}/daily-question/current", response_model=DailyQuestionRead | None)
def pregunta_actual(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> DailyQuestion | None:
    return (
        db.query(DailyQuestion)
        .filter_by(business_id=negocio.id, respuesta=None)
        .order_by(DailyQuestion.created_at.desc())
        .first()
    )


@router.post(
    "/{business_id}/daily-question/{question_id}/answer", response_model=DailyQuestionRead
)
def responder_pregunta(
    question_id: int,
    data: AnswerCreate,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> DailyQuestion:
    pregunta = (
        db.query(DailyQuestion).filter_by(id=question_id, business_id=negocio.id).one_or_none()
    )
    if pregunta is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    if pregunta.respuesta is not None:
        raise HTTPException(status_code=400, detail="Esta pregunta ya fue respondida")

    pregunta.respuesta = data.respuesta
    pregunta.fecha_respuesta = date.today()
    db.commit()
    db.refresh(pregunta)
    return pregunta
