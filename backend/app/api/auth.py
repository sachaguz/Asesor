from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    DeleteAccountRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
    VerifyEmailRequest,
)
from app.services.auth import (
    GoogleNoDisponible,
    TokenInvalido,
    create_access_token,
    crear_token_reset_password,
    crear_token_verificacion,
    decodificar_token_reset_password,
    decodificar_token_verificacion,
    hash_password,
    verificar_id_token_google,
    verify_password,
)
from app.services.email import EmailError, EmailNoConfigurado, enviar_email, plantilla_reset, plantilla_verificacion

router = APIRouter(prefix="/auth", tags=["auth"])


def _enviar_verificacion(usuario: User) -> None:
    """Best-effort: si Resend no está configurado o falla, no bloquea el
    registro — el usuario puede seguir usando la app y reintentar después
    con /auth/resend-verification."""
    link = f"{settings.app_deep_link_scheme}://verify-email?token={crear_token_verificacion(usuario.id)}"
    try:
        enviar_email(
            usuario.email, "Confirmá tu correo — El Asesor", plantilla_verificacion(usuario.nombre, link)
        )
    except (EmailNoConfigurado, EmailError):
        pass


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existente = db.query(User).filter_by(email=data.email).one_or_none()
    if existente is not None:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo")

    usuario = User(
        email=data.email,
        nombre=data.nombre,
        password_hash=hash_password(data.password),
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    _enviar_verificacion(usuario)
    return TokenResponse(access_token=create_access_token(usuario.id))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    usuario = db.query(User).filter_by(email=data.email).one_or_none()
    if usuario is None or usuario.password_hash is None or not verify_password(
        data.password, usuario.password_hash
    ):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return TokenResponse(access_token=create_access_token(usuario.id))


@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleAuthRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        info = verificar_id_token_google(data.id_token)
    except TokenInvalido as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except GoogleNoDisponible as exc:
        raise HTTPException(
            status_code=503, detail="No se pudo contactar a Google, intenta de nuevo"
        ) from exc

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="La cuenta de Google no tiene correo")
    google_id = info["sub"]
    nombre = info.get("name") or email.split("@")[0]

    usuario = db.query(User).filter_by(google_id=google_id).one_or_none()
    if usuario is None:
        usuario = db.query(User).filter_by(email=email).one_or_none()
        if usuario is not None:
            # cuenta existente creada con email/contraseña: se vincula
            usuario.google_id = google_id
        else:
            usuario = User(email=email, nombre=nombre, google_id=google_id)
            db.add(usuario)
    # Google ya verificó este correo — nunca queda pendiente de confirmar.
    usuario.email_verificado = True

    db.commit()
    db.refresh(usuario)
    return TokenResponse(access_token=create_access_token(usuario.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/verify-email")
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict[str, bool]:
    try:
        user_id = decodificar_token_verificacion(data.token)
    except TokenInvalido as exc:
        raise HTTPException(status_code=400, detail="El enlace es inválido o venció") from exc

    usuario = db.get(User, user_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.email_verificado = True
    db.commit()
    return {"verificado": True}


@router.post("/resend-verification", status_code=204)
def resend_verification(current_user: User = Depends(get_current_user)) -> None:
    if current_user.email_verificado:
        raise HTTPException(status_code=400, detail="Este correo ya está verificado")
    _enviar_verificacion(current_user)


@router.post("/forgot-password", status_code=204)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    """Siempre responde 204, exista o no la cuenta — así no se puede usar
    este endpoint para averiguar qué correos están registrados."""
    usuario = db.query(User).filter_by(email=data.email).one_or_none()
    if usuario is None:
        return
    link = f"{settings.app_deep_link_scheme}://reset-password?token={crear_token_reset_password(usuario.id)}"
    try:
        enviar_email(
            usuario.email, "Recuperar tu contraseña — El Asesor", plantilla_reset(usuario.nombre, link)
        )
    except (EmailNoConfigurado, EmailError):
        pass


@router.post("/reset-password", response_model=TokenResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user_id = decodificar_token_reset_password(data.token)
    except TokenInvalido as exc:
        raise HTTPException(status_code=400, detail="El enlace es inválido o venció") from exc

    usuario = db.get(User, user_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.password_hash = hash_password(data.password)
    db.commit()
    return TokenResponse(access_token=create_access_token(usuario.id))


@router.delete("/me", status_code=204)
def eliminar_cuenta(
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """El borrado en cascada de todo lo que dependa de esta cuenta (negocios,
    ventas, chat, Instagram conectado, etc.) lo resuelve la base de datos —
    ver ondelete=CASCADE en cada FK que cuelga de business/user."""
    esperado = f"Borro la cuenta {current_user.email}"
    if data.confirmacion != esperado:
        raise HTTPException(status_code=400, detail=f'Escribí exactamente: "{esperado}"')
    db.delete(current_user)
    db.commit()
