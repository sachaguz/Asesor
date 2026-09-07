from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.llm import get_cheap_llm_provider
from app.llm.base import LLMProvider, LLMResponse
from app.llm.mock_provider import MockProvider
from app.main import app
from helpers import importar_ventas, registrar_usuario

client = TestClient(app)


class _RecordingProvider(LLMProvider):
    """Guarda los mensajes recibidos para poder inspeccionar el grounding en tests."""

    def __init__(self) -> None:
        self.mensajes_recibidos: list = []

    def generate(self, messages, tools=None, model=None) -> LLMResponse:
        self.mensajes_recibidos = messages
        return LLMResponse(text="respuesta de prueba")


def _crear_negocio() -> tuple[int, dict[str, str]]:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses", json={"nombre": "Negocio Test", "giro": "calzado"}, headers=headers
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"], headers


def test_chat_incluye_senales_de_productos_como_grounding() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Estrella,V1,4,300.00"])

    recorder = _RecordingProvider()
    app.dependency_overrides[get_cheap_llm_provider] = lambda: recorder
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/chat",
            json={"mensaje": "¿Cómo va el Modelo Estrella?"},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    assert respuesta.status_code == 200
    assert respuesta.json()["contenido"] == "respuesta de prueba"
    assert respuesta.json()["role"] == "ASSISTANT"

    system_msg = recorder.mensajes_recibidos[0].content
    assert "Modelo Estrella" in system_msg
    assert "4 unidades vendidas" in system_msg


def test_chat_guarda_y_reenvia_el_historial() -> None:
    business_id, headers = _crear_negocio()

    app.dependency_overrides[get_cheap_llm_provider] = lambda: MockProvider(fixed_response="ok")
    try:
        client.post(f"/businesses/{business_id}/chat", json={"mensaje": "Hola"}, headers=headers)
        client.post(
            f"/businesses/{business_id}/chat", json={"mensaje": "Otra pregunta"}, headers=headers
        )
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    historial = client.get(f"/businesses/{business_id}/chat", headers=headers)
    assert historial.status_code == 200
    contenidos = [m["contenido"] for m in historial.json()]
    assert contenidos == ["Hola", "ok", "Otra pregunta", "ok"]


def test_chat_respeta_el_limite_diario_de_mensajes() -> None:
    business_id, headers = _crear_negocio()

    app.dependency_overrides[get_cheap_llm_provider] = lambda: MockProvider(fixed_response="ok")
    try:
        for i in range(15):
            respuesta = client.post(
                f"/businesses/{business_id}/chat", json={"mensaje": f"Mensaje {i}"}, headers=headers
            )
            assert respuesta.status_code == 200

        excedido = client.post(
            f"/businesses/{business_id}/chat", json={"mensaje": "Mensaje 16"}, headers=headers
        )
    finally:
        app.dependency_overrides.pop(get_cheap_llm_provider, None)

    assert excedido.status_code == 429

    historial = client.get(f"/businesses/{business_id}/chat", headers=headers)
    assert len(historial.json()) == 30  # 15 pares user/assistant, el 16º nunca se guardó


def test_chat_de_negocio_inexistente_da_404() -> None:
    headers = registrar_usuario(client)
    respuesta = client.post("/businesses/99999/chat", json={"mensaje": "Hola"}, headers=headers)
    assert respuesta.status_code == 404


def test_chat_sin_autenticar_da_401() -> None:
    respuesta = client.post("/businesses/1/chat", json={"mensaje": "Hola"})
    assert respuesta.status_code == 401
