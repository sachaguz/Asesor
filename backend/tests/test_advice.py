from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app
from helpers import importar_ventas, registrar_usuario

client = TestClient(app)


def _crear_negocio(giro: str = "calzado", config: dict | None = None) -> tuple[int, dict[str, str]]:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses",
        json={"nombre": "Negocio Test", "giro": giro, **({"config": config} if config else {})},
        headers=headers,
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"], headers


def _generar_consejos(business_id: int, headers: dict[str, str]) -> list[dict]:
    respuesta = client.post(f"/businesses/{business_id}/advice/generate", headers=headers)
    assert respuesta.status_code == 200
    return respuesta.json()


def test_producto_sin_tendencia_clara_da_vigila_con_confianza_baja() -> None:
    business_id, headers = _crear_negocio()
    # cantidad 0: hay una venta reciente pero sin unidades reales movidas, no hay
    # tendencia clara todavía (ni RESURTE ni NO_PIDAS)
    importar_ventas(client, business_id, headers, [f"{date.today().isoformat()},Producto Fantasma,V1,0,10.00"])
    consejos = _generar_consejos(business_id, headers)

    assert len(consejos) == 1
    assert consejos[0]["veredicto"] == "VIGILA"
    assert consejos[0]["confianza"] == "BAJA"


def test_producto_con_venta_reciente_da_resurte() -> None:
    business_id, headers = _crear_negocio()
    reciente = date.today() - timedelta(days=5)
    importar_ventas(client, business_id, headers, [f"{reciente.isoformat()},Modelo Activo,V1,3,500.00"])

    consejos = _generar_consejos(business_id, headers)

    assert len(consejos) == 1
    assert consejos[0]["veredicto"] == "RESURTE"
    assert consejos[0]["confianza"] == "BAJA"


def test_producto_estancado_da_no_pidas() -> None:
    business_id, headers = _crear_negocio()
    vieja = date.today() - timedelta(days=120)
    importar_ventas(
        client,
        business_id,
        headers,
        [
            f"{vieja.isoformat()},Modelo Viejo,V1,1,300.00",
        ],
    )

    consejos = _generar_consejos(business_id, headers)

    assert len(consejos) == 1
    assert consejos[0]["veredicto"] == "NO_PIDAS"


def test_umbral_dias_sin_venta_configurable_por_negocio() -> None:
    business_id, headers = _crear_negocio(config={"umbral_dias_sin_venta": 10})
    vieja = date.today() - timedelta(days=15)
    importar_ventas(client, business_id, headers, [f"{vieja.isoformat()},Modelo Config,V1,1,300.00"])

    consejos = _generar_consejos(business_id, headers)

    assert len(consejos) == 1
    assert consejos[0]["veredicto"] == "NO_PIDAS"


def test_listar_consejos_devuelve_lo_generado() -> None:
    business_id, headers = _crear_negocio()
    importar_ventas(client, business_id, headers, [f"{date.today().isoformat()},Modelo X,V1,2,100.00"])
    _generar_consejos(business_id, headers)

    respuesta = client.get(f"/businesses/{business_id}/advice", headers=headers)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1
