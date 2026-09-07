from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.llm.base import LLMProvider, Message
from app.models import Advice, Business, BusinessContext, DailyQuestion
from app.services.prompt_safety import ADVERTENCIA_INYECCION, delimitar

_TOOL_PROPONER_PREGUNTA = {
    "name": "proponer_pregunta",
    "description": "Propone la pregunta del día para el dueño del negocio.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "pregunta": {
                "type": "string",
                "description": (
                    "Una sola pregunta corta, concreta y fácil de responder, sobre "
                    "contexto que no está en los datos de ventas."
                ),
            },
        },
        "required": ["pregunta"],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = (
    "Eres el asesor de negocio de El Asesor. Cada día le haces al dueño UNA sola "
    "pregunta corta para aprender contexto que no está en sus datos de ventas (por "
    "qué un producto no se mueve, temporadas, preferencias de clientes, etc.). Usa "
    "el contexto y los consejos recientes para que la pregunta sea específica y útil, "
    "no genérica. Llama siempre a la herramienta proponer_pregunta con tu pregunta final.\n\n"
    + ADVERTENCIA_INYECCION
)

_PREGUNTA_DE_RESPALDO = "¿Hay algo sobre tu negocio que creas que deberíamos saber?"


def generar_pregunta_del_dia(db: Session, business: Business, llm: LLMProvider) -> DailyQuestion:
    """Una pregunta por día: si ya hay una de hoy —respondida o no—, la devuelve en vez de
    crear otra. Antes solo miraba si había una SIN responder, así que apenas el dueño
    contestaba (y volvía a abrir la app) se generaba una nueva de gratis; mismo patrón que
    ya usa `content_tip_generator.py`."""
    de_hoy = (
        db.query(DailyQuestion)
        .filter_by(business_id=business.id, fecha_pregunta=date.today())
        .order_by(DailyQuestion.created_at.desc())
        .first()
    )
    if de_hoy is not None:
        return de_hoy

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
        f"Consejos recientes: {[(a.veredicto.value, a.texto) for a in consejos_recientes]}."
    )
    mensaje = delimitar("datos_del_negocio", datos) + "\n\nPropón la pregunta del día."

    respuesta = llm.generate(
        messages=[
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=mensaje),
        ],
        tools=[_TOOL_PROPONER_PREGUNTA],
    )

    pregunta = DailyQuestion(
        business_id=business.id,
        fecha_pregunta=date.today(),
        pregunta=_extraer_pregunta(respuesta.tool_calls),
    )
    db.add(pregunta)
    return pregunta


def _extraer_pregunta(tool_calls: list) -> str:
    for tool_call in tool_calls:
        if tool_call.name != "proponer_pregunta":
            continue
        try:
            return tool_call.arguments["pregunta"]
        except KeyError:
            break
    return _PREGUNTA_DE_RESPALDO
