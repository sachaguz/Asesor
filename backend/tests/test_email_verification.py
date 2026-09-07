from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import crear_token_reset_password, crear_token_verificacion

client = TestClient(app)


def _registrar(email: str) -> dict[str, str]:
    respuesta = client.post(
        "/auth/register", json={"email": email, "password": "Password123", "nombre": "Test"}
    )
    assert respuesta.status_code == 201
    return {"Authorization": f"Bearer {respuesta.json()['access_token']}"}


def test_usuario_nuevo_no_esta_verificado() -> None:
    headers = _registrar("sinverificar@test.com")
    perfil = client.get("/auth/me", headers=headers)
    assert perfil.json()["email_verificado"] is False


def test_verify_email_con_token_valido() -> None:
    headers = _registrar("verificar@test.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    token = crear_token_verificacion(user_id)

    respuesta = client.post("/auth/verify-email", json={"token": token})
    assert respuesta.status_code == 200
    assert respuesta.json()["verificado"] is True

    perfil = client.get("/auth/me", headers=headers)
    assert perfil.json()["email_verificado"] is True


def test_verify_email_con_token_invalido_da_400() -> None:
    respuesta = client.post("/auth/verify-email", json={"token": "no-es-un-token"})
    assert respuesta.status_code == 400


def test_resend_verification_ya_verificado_da_400() -> None:
    headers = _registrar("yaverificado@test.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    client.post("/auth/verify-email", json={"token": crear_token_verificacion(user_id)})

    respuesta = client.post("/auth/resend-verification", headers=headers)
    assert respuesta.status_code == 400


def test_resend_verification_sin_verificar_da_204() -> None:
    headers = _registrar("pendiente@test.com")
    respuesta = client.post("/auth/resend-verification", headers=headers)
    assert respuesta.status_code == 204


def test_forgot_password_siempre_da_204() -> None:
    _registrar("existe@test.com")
    con_cuenta = client.post("/auth/forgot-password", json={"email": "existe@test.com"})
    sin_cuenta = client.post("/auth/forgot-password", json={"email": "no-existe@test.com"})
    assert con_cuenta.status_code == 204
    assert sin_cuenta.status_code == 204


def test_reset_password_con_token_valido_cambia_la_contrasena() -> None:
    headers = _registrar("reset@test.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    token = crear_token_reset_password(user_id)

    respuesta = client.post("/auth/reset-password", json={"token": token, "password": "NuevaPass123"})
    assert respuesta.status_code == 200
    assert "access_token" in respuesta.json()

    login_viejo = client.post("/auth/login", json={"email": "reset@test.com", "password": "Password123"})
    assert login_viejo.status_code == 401

    login_nuevo = client.post("/auth/login", json={"email": "reset@test.com", "password": "NuevaPass123"})
    assert login_nuevo.status_code == 200


def test_reset_password_con_token_invalido_da_400() -> None:
    respuesta = client.post(
        "/auth/reset-password", json={"token": "no-es-un-token", "password": "NuevaPass123"}
    )
    assert respuesta.status_code == 400


def test_reset_password_no_deja_reusar_el_token_de_verificacion() -> None:
    headers = _registrar("cruzado@test.com")
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    token_de_verificacion = crear_token_verificacion(user_id)

    respuesta = client.post(
        "/auth/reset-password", json={"token": token_de_verificacion, "password": "NuevaPass123"}
    )
    assert respuesta.status_code == 400
