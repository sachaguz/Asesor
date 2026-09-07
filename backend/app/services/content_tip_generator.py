from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.llm.base import LLMProvider, Message
from app.models import Advice, Business, BusinessContext, ContentTip, InstagramAccount, InstagramDailyMetric
from app.services.prompt_safety import ADVERTENCIA_INYECCION, delimitar

_TOOL_PROPONER_TIP = {
    "name": "proponer_tip_contenido",
    "description": "Propone una idea de contenido para publicar hoy en Instagram.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "tip": {
                "type": "string",
                "description": (
                    "Una idea concreta y accionable de qué publicar hoy, en 1-2 oraciones. "
                    "Específica a este negocio, nunca un consejo genérico de redes sociales."
                ),
            },
        },
        "required": ["tip"],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = (
    "Eres el asesor de redes sociales de El Asesor. Cada día le proponés al dueño del "
    "negocio UNA idea concreta de qué publicar hoy en Instagram, basada en su negocio, "
    "sus consejos de ventas recientes y, si están disponibles, sus métricas reales de "
    "Instagram (alcance, racha de publicar seguido). Nada de relleno genérico tipo "
    "'¡publicá contenido de calidad!' — la idea tiene que ser específica a ESTE negocio. "
    "Llama siempre a la herramienta proponer_tip_contenido con tu idea final.\n\n"
    + ADVERTENCIA_INYECCION
)

_TIP_DE_RESPALDO = "Mostrá tu producto más vendido de esta semana en una foto o video corto."


def generar_tip_de_contenido(db: Session, business: Business, llm: LLMProvider) -> ContentTip:
    """Un tip por día: si ya se generó el de hoy, lo devuelve en vez de crear otro."""
    hoy = date.today()
    existente = db.query(ContentTip).filter_by(business_id=business.id, fecha=hoy).one_or_none()
    if existente is not None:
        return existente

    contexto = (
        db.query(BusinessContext)
        .filter_by(business_id=business.id)
        .order_by(BusinessContext.created_at.desc())
        .limit(5)
        .all()
    )
    consejos_recientes = (
        db.query(Advice)
        .filter_by(business_id=business.id)
        .order_by(Advice.created_at.desc())
        .limit(5)
        .all()
    )

    datos = (
        f"Negocio: {business.nombre} (giro: {business.giro}).\n"
        f"Contexto conocido: {[c.texto for c in contexto if c.texto]}.\n"
        f"Consejos recientes: {[(a.veredicto.value, a.texto) for a in consejos_recientes]}.\n"
    )

    cuenta_ig = db.query(InstagramAccount).filter_by(business_id=business.id).one_or_none()
    if cuenta_ig is not None:
        datos += f"Instagram conectado: @{cuenta_ig.username}, racha actual de {cuenta_ig.racha_actual} días publicando seguido.\n"
        ultima_metrica = (
            db.query(InstagramDailyMetric)
            .filter_by(business_id=business.id)
            .order_by(InstagramDailyMetric.fecha.desc())
            .first()
        )
        if ultima_metrica is not None:
            datos += (
                f"Última métrica ({ultima_metrica.fecha}): alcance {ultima_metrica.reach}, "
                f"vistas {ultima_metrica.views}, seguidores {ultima_metrica.followers_count}.\n"
            )
    else:
        datos += "Instagram todavía no está conectado — sin métricas reales disponibles.\n"

    mensaje = delimitar("datos_del_negocio", datos) + "\n\nProponé la idea de contenido de hoy."

    respuesta = llm.generate(
        messages=[
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=mensaje),
        ],
        tools=[_TOOL_PROPONER_TIP],
    )

    tip = ContentTip(business_id=business.id, fecha=hoy, texto=_extraer_tip(respuesta.tool_calls))
    db.add(tip)
    return tip


def _extraer_tip(tool_calls: list) -> str:
    for tool_call in tool_calls:
        if tool_call.name != "proponer_tip_contenido":
            continue
        try:
            return tool_call.arguments["tip"]
        except KeyError:
            break
    return _TIP_DE_RESPALDO
