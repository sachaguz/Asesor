from fastapi.testclient import TestClient

from app.main import app
from helpers import registrar_usuario

client = TestClient(app)


def test_listar_negocios_solo_devuelve_los_del_usuario_actual() -> None:
    headers_a = registrar_usuario(client)
    headers_b = registrar_usuario(client)

    client.post("/businesses", json={"nombre": "Negocio de A", "giro": "calzado"}, headers=headers_a)
    client.post("/businesses", json={"nombre": "Negocio de B", "giro": "ropa"}, headers=headers_b)

    negocios_a = client.get("/businesses", headers=headers_a).json()
    negocios_b = client.get("/businesses", headers=headers_b).json()

    assert [n["nombre"] for n in negocios_a] == ["Negocio de A"]
    assert [n["nombre"] for n in negocios_b] == ["Negocio de B"]


def test_no_se_puede_ver_el_negocio_de_otro_usuario() -> None:
    headers_dueno = registrar_usuario(client)
    negocio = client.post(
        "/businesses", json={"nombre": "Negocio Privado", "giro": "calzado"}, headers=headers_dueno
    ).json()

    headers_otro = registrar_usuario(client)
    respuesta = client.get(f"/businesses/{negocio['id']}/advice", headers=headers_otro)

    assert respuesta.status_code == 404


def test_crear_negocio_sin_autenticar_da_401() -> None:
    respuesta = client.post("/businesses", json={"nombre": "Sin Auth", "giro": "calzado"})
    assert respuesta.status_code == 401
