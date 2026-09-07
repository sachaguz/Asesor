import uuid
from typing import Any

from fastapi.testclient import TestClient

from app.llm import get_llm_provider
from app.llm.mock_provider import MockProvider
from app.main import app


def registrar_usuario(client: TestClient) -> dict[str, str]:
    """Registra un usuario de prueba con email único y devuelve sus headers de auth."""
    email = f"user_{uuid.uuid4().hex}@test.com"
    respuesta = client.post(
        "/auth/register",
        json={"email": email, "password": "Password123", "nombre": "Test User"},
    )
    assert respuesta.status_code == 201
    token = respuesta.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def importar_ventas(
    client: TestClient, business_id: int, headers: dict[str, str], filas: list[str]
) -> dict[str, Any]:
    """Sube un CSV de ventas de prueba con encabezado "Fecha,Producto,Variante,
    Cantidad,Precio". El mapeo de columnas ahora lo detecta el LLM (ver
    app/services/column_mapper.py), así que se mockea con la respuesta que le
    correspondería a ESE encabezado — no es lo que se está probando acá."""
    csv_contenido = "Fecha,Producto,Variante,Cantidad,Precio\n" + "\n".join(filas) + "\n"
    app.dependency_overrides[get_llm_provider] = lambda: MockProvider(
        tool_response={
            "col_fecha": "Fecha",
            "col_producto": "Producto",
            "col_variante": "Variante",
            "col_cantidad": "Cantidad",
            "col_precio": "Precio",
        }
    )
    try:
        respuesta = client.post(
            f"/businesses/{business_id}/sales/import",
            files={"archivo": ("ventas.csv", csv_contenido, "text/csv")},
            headers=headers,
        )
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["errores"] == []
    return respuesta.json()
