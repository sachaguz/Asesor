from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_registrar_y_obtener_perfil() -> None:
    respuesta = client.post(
        "/auth/register",
        json={"email": "ana@test.com", "password": "Password123", "nombre": "Ana"},
    )
    assert respuesta.status_code == 201
    token = respuesta.json()["access_token"]

    perfil = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert perfil.status_code == 200
    assert perfil.json()["email"] == "ana@test.com"
    assert perfil.json()["nombre"] == "Ana"


def test_registrar_email_duplicado_da_409() -> None:
    datos = {"email": "dup@test.com", "password": "Password123", "nombre": "Dup"}
    client.post("/auth/register", json=datos)
    segunda = client.post("/auth/register", json=datos)
    assert segunda.status_code == 409


def test_login_con_credenciales_correctas() -> None:
    client.post(
        "/auth/register",
        json={"email": "login@test.com", "password": "Password123", "nombre": "Login Test"},
    )
    respuesta = client.post(
        "/auth/login", json={"email": "login@test.com", "password": "Password123"}
    )
    assert respuesta.status_code == 200
    assert "access_token" in respuesta.json()


def test_login_con_contrasena_incorrecta_da_401() -> None:
    client.post(
        "/auth/register",
        json={"email": "mal@test.com", "password": "Password123", "nombre": "Mal"},
    )
    respuesta = client.post("/auth/login", json={"email": "mal@test.com", "password": "otra-cosa"})
    assert respuesta.status_code == 401


def test_login_con_email_inexistente_da_401() -> None:
    respuesta = client.post(
        "/auth/login", json={"email": "no-existe@test.com", "password": "Password123"}
    )
    assert respuesta.status_code == 401


def test_endpoint_sin_token_da_401() -> None:
    respuesta = client.get("/auth/me")
    assert respuesta.status_code == 401


def test_endpoint_con_token_invalido_da_401() -> None:
    respuesta = client.get("/auth/me", headers={"Authorization": "Bearer token-invalido"})
    assert respuesta.status_code == 401


def test_password_corta_es_rechazada() -> None:
    respuesta = client.post(
        "/auth/register",
        json={"email": "corta@test.com", "password": "123", "nombre": "Corta"},
    )
    assert respuesta.status_code == 422


def test_password_sin_mayuscula_es_rechazada() -> None:
    respuesta = client.post(
        "/auth/register",
        json={"email": "sinmayuscula@test.com", "password": "password123", "nombre": "Test"},
    )
    assert respuesta.status_code == 422


def test_password_sin_numero_es_rechazada() -> None:
    respuesta = client.post(
        "/auth/register",
        json={"email": "sinnumero@test.com", "password": "Passwordabc", "nombre": "Test"},
    )
    assert respuesta.status_code == 422


def test_password_valida_es_aceptada() -> None:
    respuesta = client.post(
        "/auth/register",
        json={"email": "passwordvalida@test.com", "password": "Password123", "nombre": "Test"},
    )
    assert respuesta.status_code == 201


def test_google_login_crea_usuario_nuevo(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.auth.verificar_id_token_google",
        lambda token: {"sub": "google-nuevo", "email": "google-nuevo@test.com", "name": "Cuenta Google"},
    )
    respuesta = client.post("/auth/google", json={"id_token": "cualquiera"})
    assert respuesta.status_code == 200
    token = respuesta.json()["access_token"]

    perfil = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert perfil.json()["email"] == "google-nuevo@test.com"
    assert perfil.json()["nombre"] == "Cuenta Google"


def test_google_login_vincula_cuenta_existente(monkeypatch) -> None:
    client.post(
        "/auth/register",
        json={"email": "vincular@test.com", "password": "Password123", "nombre": "Vincular"},
    )
    monkeypatch.setattr(
        "app.api.auth.verificar_id_token_google",
        lambda token: {"sub": "google-vincular", "email": "vincular@test.com", "name": "Vincular"},
    )
    respuesta = client.post("/auth/google", json={"id_token": "cualquiera"})
    assert respuesta.status_code == 200
    token = respuesta.json()["access_token"]
    perfil = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert perfil.json()["email"] == "vincular@test.com"

    # login con la contraseña original sigue funcionando tras vincular
    login = client.post("/auth/login", json={"email": "vincular@test.com", "password": "Password123"})
    assert login.status_code == 200


def test_google_login_token_invalido_da_401(monkeypatch) -> None:
    from app.services.auth import TokenInvalido

    def fake_verificar(token: str) -> dict:
        raise TokenInvalido("token de Google inválido")

    monkeypatch.setattr("app.api.auth.verificar_id_token_google", fake_verificar)
    respuesta = client.post("/auth/google", json={"id_token": "malo"})
    assert respuesta.status_code == 401
