from __future__ import annotations

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(255))
    # Nullable: un usuario que entró solo con Google no tiene contraseña propia.
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    # Los que entran por Google ya tienen el correo verificado por Google
    # mismo — se marca True al crear esa cuenta, no queda pendiente de nada.
    email_verificado: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Suscripción "Redes" vía Stripe. stripe_customer_id se crea la primera
    # vez que el usuario intenta suscribirse. suscripcion_redes_activa es la
    # bandera que consulta el frontend — la actualiza el webhook de Stripe,
    # nunca el propio usuario ni el PaymentSheet directamente.
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), default=None)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), default=None)
    suscripcion_redes_activa: Mapped[bool] = mapped_column(default=False)
