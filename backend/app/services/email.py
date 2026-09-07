from __future__ import annotations

import requests

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"


class EmailNoConfigurado(RuntimeError):
    pass


class EmailError(RuntimeError):
    pass


def enviar_email(destinatario: str, asunto: str, html: str) -> None:
    if not settings.resend_api_key:
        raise EmailNoConfigurado("Resend no está configurado (falta RESEND_API_KEY)")

    respuesta = requests.post(
        RESEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={"from": settings.email_from, "to": destinatario, "subject": asunto, "html": html},
        timeout=10,
    )
    if respuesta.status_code >= 300:
        raise EmailError(f"Resend rechazó el envío: {respuesta.text}")


def plantilla_verificacion(nombre: str, link: str) -> str:
    return (
        f"<div style='font-family: sans-serif; color: #1E1B3A;'>"
        f"<h2>Hola {nombre},</h2>"
        f"<p>Confirmá tu correo para activar tu cuenta de El Asesor.</p>"
        f"<p><a href='{link}' style='color: #7C5CFC;'>Confirmar mi correo</a></p>"
        f"<p style='color: #6E6A8C; font-size: 13px;'>Si no creaste esta cuenta, ignorá este mensaje.</p>"
        f"</div>"
    )


def plantilla_reset(nombre: str, link: str) -> str:
    return (
        f"<div style='font-family: sans-serif; color: #1E1B3A;'>"
        f"<h2>Hola {nombre},</h2>"
        f"<p>Pediste restablecer tu contraseña de El Asesor.</p>"
        f"<p><a href='{link}' style='color: #7C5CFC;'>Elegir una nueva contraseña</a></p>"
        f"<p style='color: #6E6A8C; font-size: 13px;'>"
        f"Si no fuiste vos, ignorá este mensaje — tu contraseña actual sigue siendo válida."
        f"</p></div>"
    )
