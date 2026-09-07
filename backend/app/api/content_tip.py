from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.llm import get_cheap_llm_provider
from app.llm.base import LLMProvider
from app.models import Business, ContentTip
from app.schemas.content_tip import ContentTipRead
from app.services.content_tip_generator import generar_tip_de_contenido

router = APIRouter(prefix="/businesses", tags=["content-tip"])


@router.post("/{business_id}/content-tip/generate", response_model=ContentTipRead)
def generar_tip(
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_cheap_llm_provider),
) -> ContentTip:
    tip = generar_tip_de_contenido(db, negocio, llm)
    db.commit()
    db.refresh(tip)
    return tip


@router.get("/{business_id}/content-tip/current", response_model=ContentTipRead | None)
def tip_actual(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> ContentTip | None:
    return db.query(ContentTip).filter_by(business_id=negocio.id, fecha=date.today()).one_or_none()
