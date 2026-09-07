from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_business
from app.db.session import get_db
from app.llm import get_llm_provider
from app.llm.base import LLMProvider
from app.models import Advice, Business, Product, Sale, User
from app.schemas.advice import AdviceRead
from app.schemas.business import BusinessCreate, BusinessRead
from app.schemas.sale import ImportResultRead, ResumenVentasRead, SaleRead
from app.services.advisor import generar_advice_con_ia
from app.services.column_mapper import MapeoNoDetectado, detectar_mapeo
from app.services.sales_importer import SalesImporter

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.post("", response_model=BusinessRead, status_code=201)
def crear_negocio(
    data: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Business:
    negocio = Business(user_id=current_user.id, nombre=data.nombre, giro=data.giro, config=data.config)
    db.add(negocio)
    db.commit()
    db.refresh(negocio)
    return negocio


@router.get("", response_model=list[BusinessRead])
def listar_negocios(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Business]:
    return db.query(Business).filter_by(user_id=current_user.id).order_by(Business.created_at).all()


@router.post("/{business_id}/sales/import", response_model=ImportResultRead)
def importar_ventas(
    archivo: UploadFile,
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_llm_provider),
) -> ImportResultRead:
    contenido = archivo.file.read().decode("utf-8-sig")
    try:
        mapping = detectar_mapeo(llm, contenido)
    except MapeoNoDetectado as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    resultado = SalesImporter(db, negocio.id, mapping).import_csv(contenido)
    db.commit()
    return ImportResultRead(filas_importadas=resultado.filas_importadas, errores=resultado.errores)


@router.get("/{business_id}/sales", response_model=list[SaleRead])
def listar_ventas(negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)) -> list[Sale]:
    return db.query(Sale).filter_by(business_id=negocio.id).order_by(Sale.fecha).all()


@router.get("/{business_id}/sales/resumen-ayer", response_model=ResumenVentasRead)
def resumen_ventas_de_ayer(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> ResumenVentasRead:
    """No asume que el usuario importa ventas todos los días — en vez de
    filtrar estrictamente por el día calendario de ayer (que casi siempre
    daría vacío), busca el último día que sí tiene ventas cargadas."""
    ultima_fecha = db.query(func.max(Sale.fecha)).filter_by(business_id=negocio.id).scalar()
    if ultima_fecha is None:
        return ResumenVentasRead(fecha=None, monto=Decimal("0"), unidades=0)
    ventas = db.query(Sale).filter_by(business_id=negocio.id, fecha=ultima_fecha).all()
    monto = sum((v.cantidad * v.precio for v in ventas), Decimal("0"))
    unidades = sum(v.cantidad for v in ventas)
    return ResumenVentasRead(fecha=ultima_fecha, monto=monto, unidades=unidades)


@router.post("/{business_id}/advice/generate", response_model=list[AdviceRead])
def generar_consejos(
    negocio: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_llm_provider),
) -> list[AdviceRead]:
    advices = generar_advice_con_ia(db, negocio, llm)
    db.commit()
    for advice in advices:
        db.refresh(advice)
    return _con_nombre_producto(db, advices)


@router.get("/{business_id}/advice", response_model=list[AdviceRead])
def listar_consejos(
    negocio: Business = Depends(get_owned_business), db: Session = Depends(get_db)
) -> list[AdviceRead]:
    advices = db.query(Advice).filter_by(business_id=negocio.id).order_by(Advice.fecha.desc()).all()
    return _con_nombre_producto(db, advices)


def _con_nombre_producto(db: Session, advices: list[Advice]) -> list[AdviceRead]:
    """`Advice` solo guarda `product_id` — el nombre se busca acá para que el
    frontend siempre tenga de qué producto habla la tarjeta, sin depender de
    que el texto del LLM lo mencione (a veces no lo hace)."""
    if not advices:
        return []
    nombres = dict(
        db.query(Product.id, Product.nombre)
        .filter(Product.id.in_({a.product_id for a in advices}))
        .all()
    )
    return [
        AdviceRead(
            id=a.id,
            product_id=a.product_id,
            producto=nombres.get(a.product_id, "Producto"),
            veredicto=a.veredicto,
            confianza=a.confianza,
            texto=a.texto,
            datos_que_lo_respaldan=a.datos_que_lo_respaldan,
            fecha=a.fecha,
            created_at=a.created_at,
        )
        for a in advices
    ]
