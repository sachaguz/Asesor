from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.llm import get_llm_provider
from app.llm.mock_provider import MockProvider
from app.main import app
from helpers import importar_ventas, registrar_usuario

client = TestClient(app)


def _crear_negocio() -> tuple[int, dict[str, str]]:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses", json={"nombre": "Negocio Test", "giro": "calzado"}, headers=headers
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"], headers


def test_llm_puede_anular_la_sugerencia_de_las_reglas() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    # las reglas fijas dirían RESURTE (venta reciente); forzamos al LLM (mock)
    # a decidir distinto, para probar que su conclusión es la que se persiste.
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Dudoso,V1,1,500.00"])

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "consejos": [
                {
                    "producto": "Modelo Dudoso",
                    "veredicto": "VIGILA",
                    "texto": "El LLM decidió esperar más datos.",
                }
            ]
        }
    )
    try:
        respuesta = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 200
    consejos = respuesta.json()
    assert len(consejos) == 1
    assert consejos[0]["veredicto"] == "VIGILA"
    assert consejos[0]["texto"] == "El LLM decidió esperar más datos."
    assert consejos[0]["datos_que_lo_respaldan"]["sugerencia_reglas"] == "RESURTE"


def test_llm_no_disponible_usa_la_sugerencia_de_las_reglas_como_respaldo() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Normal,V1,1,500.00"])

    # MockProvider sin tool_response simula un LLM que no llamó la herramienta.
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider()
    try:
        respuesta = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 200
    consejos = respuesta.json()
    assert consejos[0]["veredicto"] == "RESURTE"
    assert consejos[0]["confianza"] == "BAJA"


def test_nunca_da_mas_de_tres_consejos() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(
        client,
        business_id,
        headers,
        [
            f"{reciente.isoformat()},Modelo Uno,V1,1,500.00",
            f"{reciente.isoformat()},Modelo Dos,V1,1,500.00",
            f"{reciente.isoformat()},Modelo Tres,V1,1,500.00",
            f"{reciente.isoformat()},Modelo Cuatro,V1,1,500.00",
            f"{reciente.isoformat()},Modelo Cinco,V1,1,500.00",
        ],
    )

    # MockProvider sin tool_response simula el respaldo de reglas fijas, que
    # también debe respetar el máximo de 3.
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider()
    try:
        respuesta = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 3


def test_generar_dos_veces_el_mismo_dia_no_vuelve_a_llamar_al_llm() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Único,V1,1,500.00"])

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "consejos": [
                {"producto": "Modelo Único", "veredicto": "VIGILA", "texto": "Primera tanda."}
            ]
        }
    )
    try:
        primera = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    # Si volviera a llamar al LLM, este mock haría fallar el request —
    # confirma que la segunda vez no se generó nada nuevo.
    mock_que_explota = MockProvider()

    def _explota(*args, **kwargs):
        raise AssertionError("no debería llamar al LLM de nuevo el mismo día")

    mock_que_explota.generate = _explota
    app.dependency_overrides[get_llm_provider] = lambda: mock_que_explota
    try:
        segunda = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert segunda.status_code == 200
    assert [c["id"] for c in segunda.json()] == [c["id"] for c in primera.json()]
    assert segunda.json()[0]["texto"] == "Primera tanda."


def test_advice_incluye_contexto_y_respuestas_previas_como_grounding() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Con Contexto,V1,1,500.00"])

    client.post(
        f"/businesses/{business_id}/context",
        json={"texto": "La talla 22 es de punta."},
        headers=headers,
    )

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={"pregunta": "¿La talla 22 siempre vende al último?"}
    )
    try:
        pregunta = client.post(
            f"/businesses/{business_id}/daily-question/generate", headers=headers
        ).json()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    client.post(
        f"/businesses/{business_id}/daily-question/{pregunta['id']}/answer",
        json={"respuesta": "Sí, siempre es la última en venderse."},
        headers=headers,
    )

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider()
    try:
        respuesta = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    contexto_usado = respuesta.json()[0]["datos_que_lo_respaldan"]["contexto_usado"]
    assert "La talla 22 es de punta." in contexto_usado
    assert any("Sí, siempre es la última en venderse." in item for item in contexto_usado)
