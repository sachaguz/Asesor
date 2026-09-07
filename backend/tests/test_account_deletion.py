from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.models import Advice, Business, Product, Sale, User, Variant
from conftest import TestSessionLocal
from helpers import importar_ventas, registrar_usuario

client = TestClient(app)


def _registrar_con_negocio() -> tuple[str, dict[str, str], int]:
    headers = registrar_usuario(client)
    email = client.get("/auth/me", headers=headers).json()["email"]
    negocio = client.post(
        "/businesses", json={"nombre": "Negocio a borrar", "giro": "calzado"}, headers=headers
    ).json()
    importar_ventas(client, negocio["id"], headers, [f"{date.today().isoformat()},Producto,V1,3,10.00"])
    client.post(f"/businesses/{negocio['id']}/advice/generate", headers=headers)
    return email, headers, negocio["id"]


def test_eliminar_cuenta_con_confirmacion_incorrecta_da_400() -> None:
    _, headers, _ = _registrar_con_negocio()
    respuesta = client.request(
        "DELETE", "/auth/me", json={"confirmacion": "texto incorrecto"}, headers=headers
    )
    assert respuesta.status_code == 400


def test_eliminar_cuenta_borra_todo_en_cascada() -> None:
    email, headers, business_id = _registrar_con_negocio()

    respuesta = client.request(
        "DELETE", "/auth/me", json={"confirmacion": f"Borro la cuenta {email}"}, headers=headers
    )
    assert respuesta.status_code == 204

    # El token ya no sirve — el usuario detrás desapareció.
    perfil = client.get("/auth/me", headers=headers)
    assert perfil.status_code == 401

    db = TestSessionLocal()
    try:
        assert db.query(User).filter_by(email=email).one_or_none() is None
        assert db.get(Business, business_id) is None
        assert db.query(Sale).filter_by(business_id=business_id).count() == 0
        assert db.query(Product).filter_by(business_id=business_id).count() == 0
        assert db.query(Variant).count() == 0
        assert db.query(Advice).filter_by(business_id=business_id).count() == 0
    finally:
        db.close()
