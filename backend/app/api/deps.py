from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Business, User
from app.services.auth import TokenInvalido, decode_access_token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = decode_access_token(token)
    except TokenInvalido as exc:
        raise HTTPException(status_code=401, detail="Token inválido o expirado") from exc

    usuario = db.get(User, user_id)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return usuario


def get_owned_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Business:
    """Un negocio de OTRO usuario responde 404, no 403 — no revela que existe."""
    negocio = db.get(Business, business_id)
    if negocio is None or negocio.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    return negocio
