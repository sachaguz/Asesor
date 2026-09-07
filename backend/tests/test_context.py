import io
from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook
from pypdf import PdfWriter

from app.main import app
from helpers import registrar_usuario

client = TestClient(app)


def _crear_negocio() -> tuple[int, dict[str, str]]:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses", json={"nombre": "Negocio Test", "giro": "calzado"}, headers=headers
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"], headers


def test_agregar_y_listar_contexto_de_texto() -> None:
    business_id, headers = _crear_negocio()

    respuesta = client.post(
        f"/businesses/{business_id}/context",
        json={"texto": "La talla 22 es de punta."},
        headers=headers,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["texto"] == "La talla 22 es de punta."

    listado = client.get(f"/businesses/{business_id}/context", headers=headers)
    assert listado.status_code == 200
    assert len(listado.json()) == 1


def test_subir_archivo_excel_extrae_texto() -> None:
    business_id, headers = _crear_negocio()

    libro = Workbook()
    hoja = libro.active
    hoja["A1"] = "Hola"
    hoja["B1"] = "Mundo"
    buffer = io.BytesIO()
    libro.save(buffer)

    respuesta = client.post(
        f"/businesses/{business_id}/context/files",
        files={
            "archivo": (
                "notas.xlsx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        headers=headers,
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert "Hola" in datos["texto"]
    assert "Mundo" in datos["texto"]
    assert datos["archivo_path"] is not None


def test_subir_pdf_no_falla_y_guarda_archivo() -> None:
    business_id, headers = _crear_negocio()

    escritor = PdfWriter()
    escritor.add_blank_page(width=72, height=72)
    buffer = io.BytesIO()
    escritor.write(buffer)

    respuesta = client.post(
        f"/businesses/{business_id}/context/files",
        files={"archivo": ("notas.pdf", buffer.getvalue(), "application/pdf")},
        headers=headers,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["archivo_path"] is not None


def test_extension_no_soportada_da_400() -> None:
    business_id, headers = _crear_negocio()

    respuesta = client.post(
        f"/businesses/{business_id}/context/files",
        files={"archivo": ("foto.jpg", b"contenido falso", "image/jpeg")},
        headers=headers,
    )

    assert respuesta.status_code == 400


def test_borrar_contexto_de_texto() -> None:
    business_id, headers = _crear_negocio()
    creado = client.post(
        f"/businesses/{business_id}/context",
        json={"texto": "La talla 22 es de punta."},
        headers=headers,
    ).json()

    respuesta = client.delete(
        f"/businesses/{business_id}/context/{creado['id']}", headers=headers
    )
    assert respuesta.status_code == 204

    listado = client.get(f"/businesses/{business_id}/context", headers=headers)
    assert listado.json() == []


def test_borrar_contexto_de_archivo_borra_tambien_el_archivo_en_disco() -> None:
    business_id, headers = _crear_negocio()

    escritor = PdfWriter()
    escritor.add_blank_page(width=72, height=72)
    buffer = io.BytesIO()
    escritor.write(buffer)

    creado = client.post(
        f"/businesses/{business_id}/context/files",
        files={"archivo": ("notas.pdf", buffer.getvalue(), "application/pdf")},
        headers=headers,
    ).json()

    ruta = Path(creado["archivo_path"])
    assert ruta.exists()

    respuesta = client.delete(
        f"/businesses/{business_id}/context/{creado['id']}", headers=headers
    )
    assert respuesta.status_code == 204
    assert not ruta.exists()


def test_borrar_contexto_inexistente_da_404() -> None:
    business_id, headers = _crear_negocio()

    respuesta = client.delete(f"/businesses/{business_id}/context/99999", headers=headers)
    assert respuesta.status_code == 404


def test_borrar_contexto_de_otro_negocio_da_404() -> None:
    business_id, headers = _crear_negocio()
    creado = client.post(
        f"/businesses/{business_id}/context",
        json={"texto": "Contexto ajeno."},
        headers=headers,
    ).json()

    _otro_id, headers_otro = _crear_negocio()
    respuesta = client.delete(
        f"/businesses/{business_id}/context/{creado['id']}", headers=headers_otro
    )
    assert respuesta.status_code == 404
