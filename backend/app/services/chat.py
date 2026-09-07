from __future__ import annotations

from sqlalchemy.orm import Session

from app.llm.base import LLMProvider
from app.llm.base import Message as LLMMessage
from app.models import Advice, Business, BusinessContext, ChatMessage, ChatRole, DailyQuestion, Product
from app.services.prompt_safety import ADVERTENCIA_INYECCION, delimitar
from app.services.signals import calcular_señales

_HISTORIAL_MAXIMO = 20

_SYSTEM_PROMPT = (
    "Eres el asesor de negocio de El Asesor. El dueño te va a preguntar libremente sobre su "
    "negocio (cómo va tal producto, qué se vende mejor, etc.). Esto es un chat, no un reporte: "
    "respondé como en una conversación real, corto y directo — 2 a 4 oraciones la mayoría de "
    "las veces, más solo si de verdad hace falta. Nada de encabezados, viñetas, ni tablas. Como "
    "mucho UNA pregunta de vuelta al final, y solo si de verdad ayuda — no encadenes varias. "
    "Responde en español, en tono cálido y directo, usando ÚNICAMENTE los datos de "
    "señales/consejos/contexto que se te dan como grounding — no inventes números que no estén "
    "ahí. Si no tienes información suficiente para responder algo, dilo con honestidad en vez de "
    "adivinar.\n\n" + ADVERTENCIA_INYECCION
)


def responder_mensaje(
    db: Session, business: Business, mensaje_usuario: str, llm: LLMProvider
) -> ChatMessage:
    db.add(ChatMessage(business_id=business.id, role=ChatRole.USER, contenido=mensaje_usuario))
    db.flush()

    historial = (
        db.query(ChatMessage)
        .filter_by(business_id=business.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(_HISTORIAL_MAXIMO)
        .all()
    )
    historial.reverse()

    grounding = _construir_grounding(db, business)
    mensajes = [
        LLMMessage(
            role="system",
            content=f"{_SYSTEM_PROMPT}\n\n{delimitar('datos_del_negocio', grounding)}",
        )
    ]
    for mensaje in historial:
        rol = "user" if mensaje.role == ChatRole.USER else "assistant"
        mensajes.append(LLMMessage(role=rol, content=mensaje.contenido))

    respuesta = llm.generate(messages=mensajes)
    texto_respuesta = respuesta.text.strip() or "No tengo una respuesta clara para eso todavía."

    mensaje_respuesta = ChatMessage(
        business_id=business.id, role=ChatRole.ASSISTANT, contenido=texto_respuesta
    )
    db.add(mensaje_respuesta)
    return mensaje_respuesta


def _construir_grounding(db: Session, business: Business) -> str:
    lineas = [f"Negocio: {business.nombre} (giro: {business.giro})."]

    productos = db.query(Product).filter_by(business_id=business.id).all()
    for producto in productos:
        señales = calcular_señales(db, producto.id)
        dias = señales.dias_desde_ultima_venta if señales.dias_desde_ultima_venta is not None else "nunca"
        lineas.append(
            f"- {producto.nombre}: {señales.unidades_vendidas} unidades vendidas, "
            f"última venta hace {dias} días, "
            f"{señales.pct_variantes_vendidas:.0%} de variantes vendidas."
        )

    consejos_recientes = (
        db.query(Advice)
        .filter_by(business_id=business.id)
        .order_by(Advice.created_at.desc())
        .limit(5)
        .all()
    )
    for advice in consejos_recientes:
        lineas.append(f"- Consejo reciente ({advice.veredicto.value}): {advice.texto}")

    contexto = (
        db.query(BusinessContext)
        .filter_by(business_id=business.id)
        .filter(BusinessContext.texto.isnot(None))
        .order_by(BusinessContext.created_at.desc())
        .limit(5)
        .all()
    )
    for c in contexto:
        lineas.append(f"- Contexto del dueño: {c.texto}")

    preguntas = (
        db.query(DailyQuestion)
        .filter_by(business_id=business.id)
        .filter(DailyQuestion.respuesta.isnot(None))
        .order_by(DailyQuestion.fecha_respuesta.desc())
        .limit(5)
        .all()
    )
    for p in preguntas:
        lineas.append(f"- P: {p.pregunta} R: {p.respuesta}")

    return "\n".join(lineas)
