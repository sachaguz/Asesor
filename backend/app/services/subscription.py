from __future__ import annotations

import stripe
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User

# stripe_version fijo del ephemeral key: tiene que coincidir con la que usa
# el SDK nativo de Stripe en el frontend (@stripe/stripe-react-native).
STRIPE_API_VERSION = "2024-06-20"

ESTADOS_ACTIVOS = ("active", "trialing")


class SubscriptionNoConfigurada(RuntimeError):
    pass


class SubscriptionAPIError(RuntimeError):
    pass


def _configurar_api_key() -> None:
    if not settings.stripe_secret_key:
        raise SubscriptionNoConfigurada("Stripe no está configurado (falta STRIPE_SECRET_KEY)")
    stripe.api_key = settings.stripe_secret_key


def _obtener_o_crear_customer(user: User) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(email=user.email, name=user.nombre)
    user.stripe_customer_id = customer.id
    return customer.id


def _suscripcion_incompleta_reutilizable(customer_id: str) -> stripe.Subscription | None:
    """Si el usuario ya abrió el PaymentSheet antes sin terminar de pagar,
    reutiliza esa suscripción "incomplete" en vez de crear otra — evita
    acumular suscripciones huérfanas en Stripe por cada intento fallido."""
    suscripciones = stripe.Subscription.list(
        customer=customer_id,
        status="incomplete",
        limit=1,
        expand=["data.latest_invoice.confirmation_secret"],
    )
    return suscripciones.data[0] if suscripciones.data else None


def crear_intento_de_suscripcion(user: User) -> tuple[str, str, str]:
    """Devuelve (payment_intent_client_secret, ephemeral_key_secret,
    customer_id) listos para que el frontend arme el PaymentSheet nativo."""
    _configurar_api_key()
    if not settings.stripe_price_id_redes:
        raise SubscriptionNoConfigurada("Stripe no está configurado (falta STRIPE_PRICE_ID_REDES)")

    try:
        customer_id = _obtener_o_crear_customer(user)
        ephemeral_key = stripe.EphemeralKey.create(customer=customer_id, stripe_version=STRIPE_API_VERSION)
        suscripcion = _suscripcion_incompleta_reutilizable(customer_id)
        if suscripcion is None:
            suscripcion = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": settings.stripe_price_id_redes}],
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                expand=["latest_invoice.confirmation_secret"],
            )
    except stripe.StripeError as exc:
        raise SubscriptionAPIError(f"Stripe rechazó el intento de suscripción: {exc}") from exc

    user.stripe_subscription_id = suscripcion.id
    # Desde la API version "Basil" (2025-03-31), Invoice ya no tiene
    # `payment_intent` — el client_secret para confirmar el pago vive acá
    # (confirmation_secret.type es siempre "payment_intent" por ahora).
    client_secret = suscripcion.latest_invoice.confirmation_secret.client_secret
    return client_secret, ephemeral_key.secret, customer_id


def _sincronizar_estado_suscripcion(db: Session, subscription_obj: dict) -> None:
    user = db.query(User).filter_by(stripe_subscription_id=subscription_obj["id"]).one_or_none()
    if user is None:
        return
    user.suscripcion_redes_activa = subscription_obj["status"] in ESTADOS_ACTIVOS


def aplicar_evento_webhook(db: Session, payload: bytes, sig_header: str) -> None:
    """Verifica la firma y actualiza suscripcion_redes_activa según el
    estado real que reporta Stripe — es la única fuente de verdad, nunca el
    resultado del PaymentSheet en el frontend (que solo confirma el cobro,
    no que la suscripción haya quedado activa del lado de Stripe)."""
    _configurar_api_key()
    if not settings.stripe_webhook_secret:
        raise SubscriptionNoConfigurada("Stripe no está configurado (falta STRIPE_WEBHOOK_SECRET)")

    try:
        evento = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise SubscriptionAPIError(f"webhook de Stripe inválido: {exc}") from exc

    if evento["type"] in ("customer.subscription.updated", "customer.subscription.deleted"):
        _sincronizar_estado_suscripcion(db, evento["data"]["object"])
