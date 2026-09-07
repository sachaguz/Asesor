from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.llm import get_llm_provider
from app.llm.mock_provider import MockProvider
from app.main import app
from helpers import registrar_usuario

client = TestClient(app)


def _crear_negocio() -> tuple[int, dict[str, str]]:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses", json={"nombre": "Zapateria Test", "giro": "calzado"}, headers=headers
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"], headers


def test_importar_csv_con_columnas_en_cualquier_orden_y_nombre() -> None:
    """El mapeo ya no lo escribe quien importa — lo infiere el LLM a partir del
    encabezado real, sea cual sea el orden o el idioma de los nombres."""
    business_id, headers = _crear_negocio()
    csv_desordenado = (
        "Modelo,Talla,Fecha Venta,Precio,Cant\n"
        "Bota Clasica,24,2026-01-15,899.00,2\n"
        "Bota Clasica,25,2026-01-16,899.00,1\n"
        "Zapato Casual,,2026-01-16,650.00,3\n"
    )

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha Venta",
            "col_producto": "Modelo",
            "col_variante": "Talla",
            "col_cantidad": "Cant",
            "col_precio": "Precio",
        }
    )
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv_desordenado, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 200
    resultado = respuesta.json()
    assert resultado["filas_importadas"] == 3
    assert resultado["errores"] == []

    ventas = client.get(f"/businesses/{business_id}/sales", headers=headers)
    assert ventas.status_code == 200
    assert len(ventas.json()) == 3


def test_importar_csv_reporta_errores_por_fila() -> None:
    business_id, headers = _crear_negocio()
    csv_con_error = (
        "Fecha,Producto,Cant,Precio\n"
        "2026-01-15,Producto A,2,100.00\n"
        "fecha-invalida,Producto B,1,100.00\n"
    )

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha",
            "col_producto": "Producto",
            "col_variante": "",
            "col_cantidad": "Cant",
            "col_precio": "Precio",
        }
    )
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv_con_error, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 200
    resultado = respuesta.json()
    assert resultado["filas_importadas"] == 1
    assert len(resultado["errores"]) == 1


def test_importar_csv_cuando_no_se_detectan_las_columnas_da_422() -> None:
    business_id, headers = _crear_negocio()
    csv_ambiguo = "A,B,C\n1,2,3\n"

    # MockProvider sin tool_response simula un LLM que no llamó la herramienta
    # (no logró identificar las columnas con confianza).
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider()
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv_ambiguo, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 422


def test_importar_csv_cuando_ia_inventa_una_columna_que_no_existe_da_422() -> None:
    business_id, headers = _crear_negocio()
    csv_simple = "Fecha,Producto,Cant,Precio\n2026-01-15,Producto A,2,100.00\n"

    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha",
            "col_producto": "Producto",
            "col_variante": "",
            "col_cantidad": "Cant",
            "col_precio": "Columna Que No Existe",
        }
    )
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv_simple, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    assert respuesta.status_code == 422


def test_importar_ventas_de_negocio_inexistente_da_404() -> None:
    headers = registrar_usuario(client)
    respuesta = client.post(
        "/businesses/99999/sales/import",
        files={"archivo": ("ventas.csv", "Fecha,Producto,Cant,Precio\n", "text/csv")},
        headers=headers,
    )
    assert respuesta.status_code == 404


def test_importar_ventas_de_otro_usuario_da_404() -> None:
    business_id, _headers_dueno = _crear_negocio()
    headers_otro = registrar_usuario(client)

    respuesta = client.post(
        f"/businesses/{business_id}/sales/import",
        files={"archivo": ("ventas.csv", "Fecha,Producto,Cant,Precio\n", "text/csv")},
        headers=headers_otro,
    )
    assert respuesta.status_code == 404


def test_resumen_ventas_de_ayer_suma_lo_vendido_ese_dia() -> None:
    business_id, headers = _crear_negocio()
    ayer = date.today() - timedelta(days=1)
    csv = (
        "Fecha,Producto,Cant,Precio\n"
        f"{ayer.isoformat()},Producto A,2,100.00\n"
        f"{ayer.isoformat()},Producto B,3,50.00\n"
    )
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha",
            "col_producto": "Producto",
            "col_variante": "",
            "col_cantidad": "Cant",
            "col_precio": "Precio",
        }
    )
    try:
        client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    respuesta = client.get(f"/businesses/{business_id}/sales/resumen-ayer", headers=headers)

    assert respuesta.status_code == 200
    resumen = respuesta.json()
    assert resumen["fecha"] == ayer.isoformat()
    assert resumen["unidades"] == 5
    assert float(resumen["monto"]) == 350.0


def test_resumen_ventas_de_ayer_usa_el_ultimo_dia_con_ventas_aunque_no_sea_ayer() -> None:
    """El usuario no tiene por qué importar ventas todos los días — si la
    última carga es de hace una semana, el resumen tiene que mostrar esa
    fecha en vez de dar vacío por no coincidir con el calendario de ayer."""
    business_id, headers = _crear_negocio()
    hace_una_semana = date.today() - timedelta(days=7)
    csv = f"Fecha,Producto,Cant,Precio\n{hace_una_semana.isoformat()},Producto A,4,100.00\n"
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha",
            "col_producto": "Producto",
            "col_variante": "",
            "col_cantidad": "Cant",
            "col_precio": "Precio",
        }
    )
    try:
        client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)

    respuesta = client.get(f"/businesses/{business_id}/sales/resumen-ayer", headers=headers)

    assert respuesta.status_code == 200
    resumen = respuesta.json()
    assert resumen["fecha"] == hace_una_semana.isoformat()
    assert resumen["unidades"] == 4
    assert float(resumen["monto"]) == 400.0


def test_resumen_ventas_de_ayer_sin_ventas_da_fecha_nula() -> None:
    business_id, headers = _crear_negocio()

    respuesta = client.get(f"/businesses/{business_id}/sales/resumen-ayer", headers=headers)

    assert respuesta.status_code == 200
    resumen = respuesta.json()
    assert resumen["fecha"] is None
    assert resumen["unidades"] == 0
    assert float(resumen["monto"]) == 0.0
