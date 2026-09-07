from app.config import settings
from app.llm.base import LLMProvider
from app.llm.mock_provider import MockProvider


def _crear_provider(nombre: str) -> LLMProvider:
    if nombre == "claude":
        from app.llm.claude_provider import ClaudeProvider

        if not settings.anthropic_api_key:
            raise RuntimeError("Falta configurar ANTHROPIC_API_KEY para usar el proveedor claude")
        return ClaudeProvider(api_key=settings.anthropic_api_key)
    if nombre == "openrouter":
        from app.llm.openrouter_provider import OpenRouterProvider

        if not settings.openrouter_api_key:
            raise RuntimeError(
                "CHEAP_LLM_PROVIDER=openrouter pero OPENROUTER_API_KEY no está configurada"
            )
        return OpenRouterProvider(api_key=settings.openrouter_api_key, model=settings.openrouter_model)
    return MockProvider()


def get_llm_provider() -> LLMProvider:
    """Dependency de FastAPI: qué proveedor usar para el consejo del día — el
    único punto que sigue en Claude, por tool-calling con grounding numérico
    donde una respuesta floja sale cara.

    Default "mock" (sin costo ni red); "claude" para la API real. Como
    dependency, los tests pueden sobreescribirla con `app.dependency_overrides`
    para inyectar un MockProvider con un `tool_response` específico.
    """
    return _crear_provider(settings.llm_provider)


def get_cheap_llm_provider() -> LLMProvider:
    """Dependency de FastAPI: qué proveedor usar para los puntos de IA de
    menor riesgo (pregunta del día, idea de contenido) — puede ser un modelo
    open source más barato sin arriesgar la confianza que sí depende del
    consejo del día. Default "mock"; "openrouter" para la API real."""
    return _crear_provider(settings.cheap_llm_provider)


__all__ = ["LLMProvider", "get_cheap_llm_provider", "get_llm_provider"]
