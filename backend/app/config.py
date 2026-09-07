from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://asesor:asesor@localhost:5432/asesor"
    env: str = "development"

    # "mock" (default, sin costo ni red) o "claude" para usar la API real.
    # Este es el proveedor "fuerte", para el consejo del día y el chat — ahí
    # una respuesta floja sale cara (ver principio del briefing: "un consejo
    # tonto mata la confianza para siempre").
    llm_provider: str = "mock"
    anthropic_api_key: str | None = None

    # Proveedor "económico" para los puntos de IA de menor riesgo (pregunta
    # del día, idea de contenido de Instagram) — separado de llm_provider a
    # propósito, para poder abaratarlos sin tocar la calidad del consejo del
    # día. "mock" (default) o "openrouter" (modelos open source vía
    # openrouter.ai, mucho más baratos que Claude). Conseguí la key en
    # openrouter.ai/keys.
    cheap_llm_provider: str = "mock"
    openrouter_api_key: str | None = None
    # DeepSeek V4 Pro vía OpenRouter: buen equilibrio precio/calidad con
    # tool-calling confiable a la fecha (agosto 2026) — cambiar acá para
    # probar otro modelo, no hace falta tocar código. Ver catálogo completo
    # en openrouter.ai/models (filtrar por "tools" en supported parameters).
    openrouter_model: str = "deepseek/deepseek-v4-pro-20260813"

    # Storage local de archivos de contexto (PDF/Excel). Sin proveedor de
    # nube decidido todavía — revisar antes de desplegar a Railway.
    context_files_dir: str = "data/context_files"

    # Auth. jwt_secret DEBE cambiarse en producción (este default es solo
    # para que el entorno de dev funcione sin configurar nada).
    jwt_secret: str = "dev-secret-cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 30  # 30 días — app móvil, sesión larga
    google_client_id: str | None = None

    # Login con Instagram ("Instagram API with Instagram Login") para conectar
    # el negocio y traer métricas reales. OJO: instagram_app_id/secret NO son
    # el App ID/Secret principal de la app de Meta — son el par que aparece
    # en el dashboard bajo Instagram > "API setup with Instagram login"
    # ("Identificador de la app de Instagram" / "Clave secreta de la app de
    # Instagram"). instagram_redirect_uri tiene que estar registrada tal cual
    # ahí mismo (no acepta wildcards).
    instagram_app_id: str | None = None
    instagram_app_secret: str | None = None
    # Meta exige HTTPS para el redirect_uri incluso en localhost — ver
    # docker/localhost-cert.pem (autofirmado, solo para levantar la API con
    # `--ssl-keyfile/--ssl-certfile` cuando se está probando este flujo).
    instagram_redirect_uri: str = "https://localhost:8000/integrations/instagram/callback"

    # Importar ventas desde una carpeta de Google Drive, en vez de subir el
    # CSV a mano. OAuth totalmente separado del login con Google (ese solo
    # verifica un id_token del cliente; esto necesita intercambio server-side
    # con client_secret y refresh_token) — credenciales "Web application"
    # nuevas en Google Cloud Console, con la Drive API habilitada.
    google_drive_client_id: str | None = None
    google_drive_client_secret: str | None = None
    google_drive_redirect_uri: str = "https://localhost:8000/integrations/google-drive/callback"

    # Envío de correo (verificación de cuenta, recuperar contraseña) vía
    # Resend. email_from usa el remitente de pruebas de Resend por defecto
    # (onboarding@resend.dev) — solo entrega a la casilla dueña de la cuenta
    # de Resend hasta que se verifique un dominio propio.
    resend_api_key: str | None = None
    email_from: str = "El Asesor <onboarding@resend.dev>"
    # Scheme de la app (ver app.json del frontend) — los links de los
    # correos son deep links que abren la app directo en la pantalla
    # correspondiente.
    app_deep_link_scheme: str = "elasesor"

    # Suscripción "Redes" vía Stripe (PaymentSheet nativo, no Checkout
    # hospedado). stripe_secret_key y stripe_webhook_secret salen del
    # dashboard de Stripe (Developers > API keys / webhook). Mientras se
    # prueba, usar las claves del sandbox de Stripe (sk_test_/whsec_...) — las
    # de modo live recién al lanzar de verdad. stripe_price_id_redes es el ID
    # (price_...) del precio recurrente del producto "Redes" en Product
    # catalog. Sin stripe_secret_key, /subscription responde 503.
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id_redes: str | None = None


settings = Settings()
