from __future__ import annotations

import io

import openpyxl
from pypdf import PdfReader


class ExtraccionNoSoportada(ValueError):
    pass


def extraer_texto(nombre_archivo: str, contenido: bytes) -> str:
    """Extrae texto plano de un archivo de contexto (PDF, Excel o texto).

    Sin OCR de fotos de libreta — queda fuera del MVP según el briefing.
    """
    extension = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else ""

    if extension == "pdf":
        return _extraer_pdf(contenido)
    if extension == "xlsx":
        return _extraer_excel(contenido)
    if extension in ("txt", "csv"):
        return contenido.decode("utf-8-sig", errors="replace")

    raise ExtraccionNoSoportada(
        f"No se puede extraer texto de archivos .{extension or '?'}; "
        "usa PDF, Excel (.xlsx) o texto plano (.txt/.csv)."
    )


def _extraer_pdf(contenido: bytes) -> str:
    lector = PdfReader(io.BytesIO(contenido))
    paginas = [pagina.extract_text() or "" for pagina in lector.pages]
    return "\n".join(paginas).strip()


def _extraer_excel(contenido: bytes) -> str:
    libro = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
    lineas: list[str] = []
    for hoja in libro.worksheets:
        lineas.append(f"[{hoja.title}]")
        for fila in hoja.iter_rows(values_only=True):
            valores = [str(valor) for valor in fila if valor is not None]
            if valores:
                lineas.append(" | ".join(valores))
    return "\n".join(lineas).strip()
