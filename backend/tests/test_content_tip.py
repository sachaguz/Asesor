from fastapi.testclient import TestClient

from app.llm import get_cheap_llm_provider
from app.llm.mock_provider import MockProvider
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


def test_generar_tip_usa_la_respuesta_del_llm() -> None:
    business_id, headers = _crear_negocio()

    app.dependency_overrides[get_cheap_llm_provider] = lambda: MockProvider(
        tool_response={"tip": "Mostrá cómo armás un pedido, en un video corto detrás de cámara."}
    )
    try:
        respuesta = client.post(f"/businesses/{business_id}/content-tip/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    assert respuesta.status_code == 200
    assert respuesta.json()["texto"] == "Mostrá cómo armás un pedido, en un video corto detrás de cámara."


def test_generar_tip_dos_veces_no_duplica_el_de_hoy() -> None:
    business_id, headers = _crear_negocio()

    primera = client.post(f"/businesses/{business_id}/content-tip/generate", headers=headers)
    segunda = client.post(f"/businesses/{business_id}/content-tip/generate", headers=headers)

    assert primera.json()["id"] == segunda.json()["id"]


def test_tip_actual_antes_de_generar_da_null() -> None:
    business_id, headers = _crear_negocio()

    respuesta = client.get(f"/businesses/{business_id}/content-tip/current", headers=headers)
    assert respuesta.status_code == 200
    assert respuesta.json() is None


def test_tip_actual_despues_de_generar_lo_devuelve() -> None:
    business_id, headers = _crear_negocio()
    generado = client.post(f"/businesses/{business_id}/content-tip/generate", headers=headers).json()

    actual = client.get(f"/businesses/{business_id}/content-tip/current", headers=headers)
    assert actual.status_code == 200
    assert actual.json()["id"] == generado["id"]
