from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import User
from conftest import TestSessionLocal
from helpers import registrar_usuario

client = TestClient(app)


def _configurar_stripe(monkeypatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_falso")
    monkeypatch.setattr(settings, "stripe_price_id_redes", "price_falso")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_falso")


def test_estado_sin_suscripcion() -> None:
    headers = registrar_usuario(client)
    respuesta = client.get("/subscription/estado", headers=headers)
    assert respuesta.status_code == 200
    assert respuesta.json() == {"suscrito": False}


def test_payment_sheet_sin_configurar_da_503(monkeypatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    headers = registrar_usuario(client)
    respuesta = client.post("/subscription/payment-sheet", headers=headers)
    assert respuesta.status_code == 503


def test_payment_sheet_devuelve_client_secret(monkeypatch) -> None:
    _configurar_stripe(monkeypatch)
    headers = registrar_usuario(client)

    customer_falso = SimpleNamespace(id="cus_falso")
    ephemeral_key_falso = SimpleNamespace(secret="ek_falso")
    confirmation_secret_falso = SimpleNamespace(client_secret="pi_falso_secret")
    suscripcion_falsa = SimpleNamespace(
        id="sub_falso", latest_invoice=SimpleNamespace(confirmation_secret=confirmation_secret_falso)
    )

    monkeypatch.setattr("app.services.subscription.stripe.Customer.create", lambda **kw: customer_falso)
    monkeypatch.setattr(
        "app.services.subscription.stripe.EphemeralKey.create", lambda **kw: ephemeral_key_falso
    )
    monkeypatch.setattr(
        "app.services.subscription.stripe.Subscription.list",
        lambda **kw: SimpleNamespace(data=[]),
    )
    monkeypatch.setattr(
        "app.services.subscription.stripe.Subscription.create", lambda **kw: suscripcion_falsa
    )

    respuesta = client.post("/subscription/payment-sheet", headers=headers)
    assert respuesta.status_code == 200
    data = respuesta.json()
    assert data["payment_intent_client_secret"] == "pi_falso_secret"
    assert data["ephemeral_key_secret"] == "ek_falso"
    assert data["customer_id"] == "cus_falso"

    email = client.get("/auth/me", headers=headers).json()["email"]
    db = TestSessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        assert user.stripe_customer_id == "cus_falso"
        assert user.stripe_subscription_id == "sub_falso"
        assert user.suscripcion_redes_activa is False
    finally:
        db.close()


def test_webhook_firma_invalida_da_400(monkeypatch) -> None:
    _configurar_stripe(monkeypatch)

    def _falla_firma(payload, sig_header, secret):
        raise ValueError("firma inválida")

    monkeypatch.setattr("app.services.subscription.stripe.Webhook.construct_event", _falla_firma)

    respuesta = client.post(
        "/subscription/webhook", content=b"{}", headers={"stripe-signature": "firma-cualquiera"}
    )
    assert respuesta.status_code == 400


def test_webhook_activa_la_suscripcion(monkeypatch) -> None:
    _configurar_stripe(monkeypatch)
    headers = registrar_usuario(client)
    email = client.get("/auth/me", headers=headers).json()["email"]

    db = TestSessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        user.stripe_subscription_id = "sub_webhook"
        db.commit()
    finally:
        db.close()

    evento_falso = {
        "type": "customer.subscription.updated",
        "data": {"object": {"id": "sub_webhook", "status": "active"}},
    }
    monkeypatch.setattr(
        "app.services.subscription.stripe.Webhook.construct_event",
        lambda payload, sig_header, secret: evento_falso,
    )

    respuesta = client.post(
        "/subscription/webhook", content=b"{}", headers={"stripe-signature": "firma-valida"}
    )
    assert respuesta.status_code == 200

    db = TestSessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        assert user.suscripcion_redes_activa is True
    finally:
        db.close()


def test_webhook_desactiva_la_suscripcion_al_cancelarse(monkeypatch) -> None:
    _configurar_stripe(monkeypatch)
    headers = registrar_usuario(client)
    email = client.get("/auth/me", headers=headers).json()["email"]

    db = TestSessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        user.stripe_subscription_id = "sub_cancelado"
        user.suscripcion_redes_activa = True
        db.commit()
    finally:
        db.close()

    evento_falso = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": "sub_cancelado", "status": "canceled"}},
    }
    monkeypatch.setattr(
        "app.services.subscription.stripe.Webhook.construct_event",
        lambda payload, sig_header, secret: evento_falso,
    )

    respuesta = client.post(
        "/subscription/webhook", content=b"{}", headers={"stripe-signature": "firma-valida"}
    )
    assert respuesta.status_code == 200

    db = TestSessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        assert user.suscripcion_redes_activa is False
    finally:
        db.close()
