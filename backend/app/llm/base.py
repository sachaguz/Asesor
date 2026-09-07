from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class Message:
    role: Literal["system", "user", "assistant", "tool"]
    content: str


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)


class LLMProvider(ABC):
    """Interfaz del proveedor de LLM.

    Recibe mensajes y, opcionalmente, herramientas que el modelo puede pedir
    invocar antes de responder (tool calling) — necesario porque el LLM va a
    razonar sobre señales/reglas para decidir el consejo, no solo a redactarlo.
    """

    @abstractmethod
    def generate(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        """`model` pisa el modelo default del proveedor para esta llamada
        puntual — para tareas simples (ej. clasificar columnas de un CSV)
        que no necesitan el modelo más caro que sí justifica dar un
        consejo."""
        ...
