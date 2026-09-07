from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_owned_business
from app.db.session import get_db
from app.models import Business, BusinessContext
from app.schemas.context import BusinessContextRead, ContextTextCreate
from app.services.context_extractor import ExtraccionNoSoportada, extraer_texto
from app.services.context_files import guardar_archivo

router = APIRouter(prefix="/businesses", tags=["context"])


@router.post("/{business_id}/context", response_model=BusinessContextRead, status_code=201)
def agregar_contexto_texto(
    data: ContextTextCreate,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> BusinessContext:
    contexto = BusinessContext(business_id=negocio.id, texto=data.texto)
    db.add(contexto)
    db.commit()
    db.refresh(contexto)
    return contexto


@router.post("/{business_id}/context/files", response_model=BusinessContextRead, status_code=201)
def agregar_contexto_archivo(
    archivo: UploadFile,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> BusinessContext:
    contenido = archivo.file.read()

    try:
        texto = extraer_texto(archivo.filename or "", contenido)
    except ExtraccionNoSoportada as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ruta = guardar_archivo(negocio.id, archivo.filename or "archivo", contenido)

    contexto = BusinessContext(business_id=negocio.id, texto=texto, archivo_path=ruta)
    db.add(contexto)
    db.commit()
    db.refresh(contexto)
    return contexto


@router.get("/{business_id}/context", response_model=list[BusinessContextRead])
def listar_contexto(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> list[BusinessContext]:
    return (
        db.query(BusinessContext)
        .filter_by(business_id=negocio.id)
        .order_by(BusinessContext.created_at)
        .all()
    )


@router.delete("/{business_id}/context/{context_id}", status_code=204)
def borrar_contexto(
    context_id: int,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> None:
    contexto = (
        db.query(BusinessContext).filter_by(id=context_id, business_id=negocio.id).one_or_none()
    )
    if contexto is None:
        raise HTTPException(status_code=404, detail="Contexto no encontrado")

    if contexto.archivo_path:
        Path(contexto.archivo_path).unlink(missing_ok=True)

    db.delete(contexto)
    db.commit()
