from __future__ import annotations

from typing import Any

import anthropic

from app.llm.base import LLMProvider, LLMResponse, Message, ToolCall

MODEL_DEFAULT = "claude-sonnet-5"


class ClaudeProvider(LLMProvider):
    """Proveedor hosted real, usando la API de Claude."""

    def __init__(self, api_key: str, model: str = MODEL_DEFAULT) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        system = next((m.content for m in messages if m.role == "system"), None)
        conversacion = [
            {"role": m.role, "content": m.content} for m in messages if m.role != "system"
        ]

        kwargs: dict[str, Any] = {}
        if system is not None:
            kwargs["system"] = system

        respuesta = self._client.messages.create(
            model=model or self._model,
            max_tokens=16000,
            messages=conversacion,
            tools=tools or [],
            **kwargs,
        )

        texto = "".join(bloque.text for bloque in respuesta.content if bloque.type == "text")
        tool_calls = [
            ToolCall(name=bloque.name, arguments=bloque.input)
            for bloque in respuesta.content
            if bloque.type == "tool_use"
        ]
        return LLMResponse(text=texto, tool_calls=tool_calls)
