from typing import Any

from app.llm.base import LLMProvider, LLMResponse, Message, ToolCall


class MockProvider(LLMProvider):
    """Respuestas fijas, para construir y probar el backend sin depender de
    infraestructura de IA (ni costo, ni red).

    Si se le da `tool_response` y la llamada incluye herramientas, "llama" a
    la primera herramienta con esos argumentos — simula que el modelo decidió
    usar la herramienta, sin razonar de verdad. Útil para probar en tests que
    el resto del sistema respeta lo que el LLM decide.
    """

    def __init__(
        self,
        fixed_response: str = "Este es un consejo de prueba del MockProvider.",
        tool_response: dict[str, Any] | None = None,
    ) -> None:
        self.fixed_response = fixed_response
        self.tool_response = tool_response

    def generate(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        if tools and self.tool_response is not None:
            return LLMResponse(
                text="",
                tool_calls=[ToolCall(name=tools[0]["name"], arguments=self.tool_response)],
            )
        return LLMResponse(text=self.fixed_response)
