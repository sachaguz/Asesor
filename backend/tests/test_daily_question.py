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


def test_generar_pregunta_usa_la_respuesta_del_llm() -> None:
    business_id, headers = _crear_negocio()

    app.dependency_overrides[get_cheap_llm_provider] = lambda: MockProvider(
        tool_response={"pregunta": "¿Qué modelos se venden más en diciembre?"}
    )
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/daily-question/generate", headers=headers
        )
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    assert respuesta.status_code == 200
    assert respuesta.json()["pregunta"] == "¿Qué modelos se venden más en diciembre?"
    assert respuesta.json()["respuesta"] is None


def test_generar_pregunta_dos_veces_no_duplica_la_pendiente() -> None:
    business_id, headers = _crear_negocio()

    primera = client.post(f"/businesses/{business_id}/daily-question/generate", headers=headers)
    segunda = client.post(f"/businesses/{business_id}/daily-question/generate", headers=headers)

    assert primera.json()["id"] == segunda.json()["id"]


def test_responder_pregunta_la_saca_de_current() -> None:
    business_id, headers = _crear_negocio()

    generada = client.post(
        f"/businesses/{business_id}/daily-question/generate", headers=headers
    ).json()
    question_id = generada["id"]

    respuesta = client.post(
        f"/businesses/{business_id}/daily-question/{question_id}/answer",
        json={"respuesta": "Las botas de invierno."},
        headers=headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["respuesta"] == "Las botas de invierno."
    assert respuesta.json()["fecha_respuesta"] is not None

    actual = client.get(f"/businesses/{business_id}/daily-question/current", headers=headers)
    assert actual.status_code == 200
    assert actual.json() is None


def test_generar_pregunta_no_crea_otra_el_mismo_dia_aunque_ya_se_haya_respondido() -> None:
    """Antes solo evitaba duplicar la pendiente — apenas se respondía, el próximo
    `generate` (p.ej. al reabrir la app) llamaba al LLM de nuevo el mismo día."""
    business_id, headers = _crear_negocio()

    generada = client.post(
        f"/businesses/{business_id}/daily-question/generate", headers=headers
    ).json()
    client.post(
        f"/businesses/{business_id}/daily-question/{generada['id']}/answer",
        json={"respuesta": "Las botas de invierno."},
        headers=headers,
    )

    mock_que_explota = MockProvider()

    def _explota(*args, **kwargs):
        raise AssertionError("no debería llamar al LLM de nuevo el mismo día")

    mock_que_explota.generate = _explota
    app.dependency_overrides[get_cheap_llm_provider] = lambda: mock_que_explota
    try:
        otra_vez = client.post(
            f"/businesses/{business_id}/daily-question/generate", headers=headers
        )
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    assert otra_vez.status_code == 200
    assert otra_vez.json()["id"] == generada["id"]
    assert otra_vez.json()["respuesta"] == "Las botas de invierno."


def test_responder_pregunta_ya_respondida_da_400() -> None:
    business_id, headers = _crear_negocio()
    generada = client.post(
        f"/businesses/{business_id}/daily-question/generate", headers=headers
    ).json()
    question_id = generada["id"]

    client.post(
        f"/businesses/{business_id}/daily-question/{question_id}/answer",
        json={"respuesta": "Primera respuesta."},
        headers=headers,
    )
    segunda = client.post(
        f"/businesses/{business_id}/daily-question/{question_id}/answer",
        json={"respuesta": "Segunda respuesta."},
        headers=headers,
    )

    assert segunda.status_code == 400
