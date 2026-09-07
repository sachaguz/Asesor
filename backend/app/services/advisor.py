from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.llm.base import LLMProvider, Message
from app.models import Advice, Business, BusinessContext, Confianza, DailyQuestion, Product, Veredicto
from app.rules import UMBRAL_DIAS_SIN_VENTA_DEFAULT, Evaluacion, reglas_para_giro
from app.services.prompt_safety import ADVERTENCIA_INYECCION, delimitar
from app.services.signals import calcular_señales

_MAX_CONSEJOS = 3

_TOOL_DAR_CONSEJOS = {
    "name": "dar_consejos_del_dia",
    "description": (
        f"Registra los consejos del día: como mucho {_MAX_CONSEJOS}, los más "
        "importantes para el negocio ahora mismo. No es uno por cada producto — "
        "elegí solo los que de verdad valga la pena decirle hoy al dueño."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "consejos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "producto": {
                            "type": "string",
                            "description": "Nombre EXACTO del producto, tal como se te dio.",
                        },
                        "veredicto": {
                            "type": "string",
                            "enum": ["RESURTE", "NO_PIDAS", "VIGILA"],
                        },
                        "texto": {
                            "type": "string",
                            "description": (
                                "El consejo, corto y directo: 2 o 3 oraciones como mucho, sin "
                                "relleno ni rodeos."
                            ),
                        },
                    },
                    "required": ["producto", "veredicto", "texto"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["consejos"],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = (
    "Eres el asesor de negocio de El Asesor. Te doy las señales y la sugerencia de las "
    "reglas fijas para TODOS los productos de un negocio. Tu trabajo es elegir, como "
    f"mucho {_MAX_CONSEJOS}, los productos más importantes para decirle algo al dueño "
    "HOY — no evalúes todos, prioriza los que de verdad cambian una decisión (lo que "
    "urge resurtir, lo que hay que dejar de pedir, o lo que hay que vigilar de cerca). "
    "Si hay menos de eso que valga la pena mencionar, devolvé menos. Cada consejo debe "
    "ser corto — 2 o 3 oraciones, cálido pero directo, sin listas ni encabezados, como "
    "si se lo dijeras en persona — no un reporte. Nombrá el producto por su nombre en "
    "el texto (no lo des por sobreentendido) — el dueño tiene que poder leer el consejo "
    "solo, sin mirar ningún otro dato, y saber de qué producto le estás hablando. Usa "
    "ÚNICAMENTE los números de las "
    "señales que se te dan como grounding: no inventes datos que no estén ahí. Las "
    "reglas fijas ya calcularon una sugerencia por producto; podés confirmarla o "
    "cambiarla si el razonamiento lo justifica, pero siempre debes llamar a "
    "dar_consejos_del_dia con tu conclusión final.\n\n" + ADVERTENCIA_INYECCION
)


def generar_advice_con_ia(db: Session, business: Business, llm: LLMProvider) -> list[Advice]:
    """Como mucho una tanda de consejos por día: si ya se generaron hoy, se
    devuelven esos en vez de llamar al LLM de nuevo — evita que el botón
    "Generar consejos de hoy" (sin límite en el frontend) se pueda usar para
    gastar sin control."""
    de_hoy = db.query(Advice).filter_by(business_id=business.id, fecha=date.today()).all()
    if de_hoy:
        return de_hoy

    umbral = business.config.get("umbral_dias_sin_venta", UMBRAL_DIAS_SIN_VENTA_DEFAULT)
    reglas = reglas_para_giro(business.giro, umbral_dias_sin_venta=umbral)
    contexto_usado = _recolectar_contexto(db, business.id)

    productos = db.query(Product).filter_by(business_id=business.id).all()
    if not productos:
        return []

    sugerencias: dict[str, tuple[Product, Evaluacion]] = {}
    lineas_productos = []
    for producto in productos:
        señales = calcular_señales(db, producto.id)
        sugerencia = reglas.evaluar(producto.nombre, señales)
        sugerencias[producto.nombre] = (producto, sugerencia)
        lineas_productos.append(
            f"- {producto.nombre}: señales={sugerencia.datos}, sugerencia de las reglas: "
            f"{sugerencia.veredicto.value} — {sugerencia.texto}"
        )

    datos = (
        f"Negocio: {business.nombre} (giro: {business.giro}).\n"
        f"Contexto que aportó el dueño (trátalo como pistas, no verdades absolutas): "
        f"{contexto_usado or 'ninguno todavía'}.\n\n"
        "Productos y sus señales:\n" + "\n".join(lineas_productos)
    )
    mensaje_usuario = (
        delimitar("datos_del_negocio", datos)
        + f"\n\nElegí como mucho {_MAX_CONSEJOS} — los más importantes para decirle al "
        "dueño hoy — y llamá a dar_consejos_del_dia."
    )

    respuesta = llm.generate(
        messages=[
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=mensaje_usuario),
        ],
        tools=[_TOOL_DAR_CONSEJOS],
    )

    advices: list[Advice] = []
    for producto, veredicto, texto, sugerencia in _extraer_consejos(respuesta.tool_calls, sugerencias):
        advice = Advice(
            business_id=business.id,
            product_id=producto.id,
            fecha=date.today(),
            veredicto=veredicto,
            confianza=Confianza.BAJA,
            texto=texto,
            datos_que_lo_respaldan={
                **sugerencia.datos,
                "sugerencia_reglas": sugerencia.veredicto.value,
                "contexto_usado": contexto_usado,
            },
        )
        db.add(advice)
        advices.append(advice)
    return advices


def _recolectar_contexto(db: Session, business_id: int) -> list[str]:
    """Contexto libre + respuestas a la pregunta del día, para pasarle al LLM como
    grounding y para dejar trazado en el Advice que la respuesta se usó."""
    contexto_texto = (
        db.query(BusinessContext)
        .filter_by(business_id=business_id)
        .filter(BusinessContext.texto.isnot(None))
        .order_by(BusinessContext.created_at.desc())
        .limit(5)
        .all()
    )
    preguntas_respondidas = (
        db.query(DailyQuestion)
        .filter_by(business_id=business_id)
        .filter(DailyQuestion.respuesta.isnot(None))
        .order_by(DailyQuestion.fecha_respuesta.desc())
        .limit(5)
        .all()
    )

    return [c.texto for c in contexto_texto if c.texto] + [
        f"P: {p.pregunta} R: {p.respuesta}" for p in preguntas_respondidas
    ]


def _extraer_consejos(
    tool_calls: list, sugerencias: dict[str, tuple[Product, Evaluacion]]
) -> list[tuple[Product, Veredicto, str, Evaluacion]]:
    for tool_call in tool_calls:
        if tool_call.name != "dar_consejos_del_dia":
            continue
        items: list[tuple[Product, Veredicto, str, Evaluacion]] = []
        for item in tool_call.arguments.get("consejos", [])[:_MAX_CONSEJOS]:
            entrada = sugerencias.get(item.get("producto", ""))
            if not entrada:
                continue  # el LLM nombró un producto que no le dimos: se ignora
            producto, sugerencia = entrada
            try:
                veredicto = Veredicto(item["veredicto"])
                texto = item["texto"]
            except (KeyError, ValueError):
                continue
            items.append((producto, veredicto, texto, sugerencia))
        if items:
            return items
        break
    # el LLM no llamó la herramienta (o no devolvió nada usable): usamos las
    # primeras sugerencias de las reglas fijas como respaldo.
    return [
        (producto, sugerencia.veredicto, sugerencia.texto, sugerencia)
        for producto, sugerencia in list(sugerencias.values())[:_MAX_CONSEJOS]
    ]
