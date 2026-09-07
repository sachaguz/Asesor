from __future__ import annotations

import json
from typing import Any

import requests

from app.llm.base import LLMProvider, LLMResponse, Message, ToolCall

CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterAPIError(RuntimeError):
    pass


def _tool_a_formato_openai(tool: dict[str, Any]) -> dict[str, Any]:
    """OpenRouter habla el formato de function-calling de OpenAI, no el de
    Anthropic (`input_schema` -> `parameters`, envuelto en `function`) — los
    tools ya definidos en el resto de la app (ver advisor.py) no cambian,
    solo se traducen acá antes de mandarlos."""
    funcion: dict[str, Any] = {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "parameters": tool["input_schema"],
    }
    if "strict" in tool:
        funcion["strict"] = tool["strict"]
    return {"type": "function", "function": funcion}


class OpenRouterProvider(LLMProvider):
    """Proveedor hosted vía OpenRouter (openrouter.ai) — una sola API
    compatible con OpenAI para modelos open source de varios proveedores
    (Qwen, DeepSeek, GLM, Kimi, etc.), bastante más baratos que Claude. Para
    los puntos de IA de menor riesgo (pregunta del día, idea de contenido),
    no para el consejo del día ni el chat — ver [[asesor-costos-ia]] en la
    memoria del proyecto para el porqué."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def generate(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": model or self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            # Sin esto, algunos proveedores detrás de OpenRouter piden hasta
            # 65536 por default — de sobra para las respuestas cortas que
            # generan estos endpoints (pregunta del día, idea de contenido),
            # y hace que la cuenta se quede sin crédito mucho antes de lo
            # que el uso real ameritaría.
            "max_tokens": 2000,
        }
        if tools:
            payload["tools"] = [_tool_a_formato_openai(t) for t in tools]

        respuesta = requests.post(
            CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "X-Title": "El Asesor",
            },
            json=payload,
            timeout=30,
        )
        if respuesta.status_code != 200:
            raise OpenRouterAPIError(f"OpenRouter rechazó la request: {respuesta.text}")

        mensaje = respuesta.json()["choices"][0]["message"]
        tool_calls = [
            ToolCall(
                name=llamada["function"]["name"],
                arguments=json.loads(llamada["function"]["arguments"]),
            )
            for llamada in mensaje.get("tool_calls") or []
        ]
        return LLMResponse(text=mensaje.get("content") or "", tool_calls=tool_calls)
