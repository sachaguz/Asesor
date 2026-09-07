from __future__ import annotations

import csv
import io

from app.llm.base import LLMProvider, Message
from app.services.sales_importer import ColumnMapping

_MAX_FILAS_MUESTRA = 5

# Identificar columnas es clasificación simple, no requiere el modelo que sí
# justifica razonar un consejo — Haiku es más rápido y ~5x más barato, de
# sobra para esto.
_MODELO_MAPEO = "claude-haiku-4-5"

_TOOL_MAPEAR_COLUMNAS = {
    "name": "mapear_columnas",
    "description": (
        "Registra qué columna del CSV corresponde a cada dato de una venta, usando "
        "el nombre EXACTO de la columna tal como aparece en el encabezado."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "col_fecha": {
                "type": "string",
                "description": "Columna con la fecha en que se hizo la venta.",
            },
            "col_producto": {
                "type": "string",
                "description": "Columna con el nombre o modelo del producto vendido.",
            },
            "col_cantidad": {
                "type": "string",
                "description": "Columna con la cantidad de unidades vendidas en esa fila.",
            },
            "col_precio": {
                "type": "string",
                "description": "Columna con el precio de venta.",
            },
            "col_variante": {
                "type": "string",
                "description": (
                    "Columna de talla, color u otra variante del producto, si el CSV "
                    "tiene una. Si no hay ninguna columna así, usa cadena vacía."
                ),
            },
        },
        "required": ["col_fecha", "col_producto", "col_cantidad", "col_precio", "col_variante"],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = (
    "Eres el asistente de importación de ventas de El Asesor. El dueño de un negocio "
    "subió un CSV de ventas exportado de quién sabe qué sistema — el orden y los "
    "nombres de columna no son fijos, cada negocio los trae distinto. Tu trabajo es "
    "identificar, mirando el encabezado y las filas de muestra, qué columna "
    "corresponde a la fecha de venta, el producto, la cantidad vendida, el precio, y "
    "la variante (talla/color) si existe. Los nombres de columna pueden venir en "
    "cualquier idioma, abreviados, o no describir bien el contenido — fijate también "
    "en los valores de las filas de muestra para decidir. Llama siempre a "
    "mapear_columnas con tu mejor conclusión, usando el nombre EXACTO de columna tal "
    "como aparece en el encabezado (respetando mayúsculas, acentos y espacios)."
)


class MapeoNoDetectado(ValueError):
    pass


def detectar_mapeo(llm: LLMProvider, contenido_csv: str) -> ColumnMapping:
    """Le pide al LLM que identifique qué columna del CSV es cuál, en vez de
    obligar a quien importa a escribir los nombres a mano — el CSV puede
    venir de cualquier sistema, en cualquier orden (ver decisión de
    arquitectura: SalesImporter es genérico por diseño)."""
    lector = csv.DictReader(io.StringIO(contenido_csv))
    encabezado = lector.fieldnames
    if not encabezado:
        raise MapeoNoDetectado("El archivo no tiene encabezado o está vacío.")

    muestra = []
    for fila in lector:
        muestra.append(fila)
        if len(muestra) >= _MAX_FILAS_MUESTRA:
            break

    mensaje = (
        f"Columnas del encabezado: {list(encabezado)}\n\n"
        "Filas de muestra:\n" + "\n".join(str(fila) for fila in muestra)
    )

    respuesta = llm.generate(
        messages=[
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=mensaje),
        ],
        tools=[_TOOL_MAPEAR_COLUMNAS],
        model=_MODELO_MAPEO,
    )

    encabezado_set = set(encabezado)
    for tool_call in respuesta.tool_calls:
        if tool_call.name != "mapear_columnas":
            continue
        args = tool_call.arguments
        requeridas = {
            "fecha": args.get("col_fecha") or "",
            "producto": args.get("col_producto") or "",
            "cantidad": args.get("col_cantidad") or "",
            "precio": args.get("col_precio") or "",
        }
        faltantes = [campo for campo, col in requeridas.items() if col not in encabezado_set]
        if faltantes:
            raise MapeoNoDetectado(
                f"No pude identificar con seguridad estas columnas: {', '.join(faltantes)}. "
                "Revisa que el archivo tenga encabezados y una fila por venta."
            )
        variante = args.get("col_variante") or None
        if variante and variante not in encabezado_set:
            variante = None
        return ColumnMapping(
            fecha=requeridas["fecha"],
            producto=requeridas["producto"],
            cantidad=requeridas["cantidad"],
            precio=requeridas["precio"],
            variante=variante,
        )

    raise MapeoNoDetectado("No pude reconocer las columnas de este archivo.")
