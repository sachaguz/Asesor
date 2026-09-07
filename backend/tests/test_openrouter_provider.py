from types import SimpleNamespace

from app.llm.base import Message
from app.llm.openrouter_provider import OpenRouterAPIError, OpenRouterProvider

_TOOL = {
    "name": "dar_consejos_del_dia",
    "description": "Registra los consejos del día.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {"consejos": {"type": "array"}},
        "required": ["consejos"],
        "additionalProperties": False,
    },
}


def test_generate_traduce_el_tool_al_formato_openai(monkeypatch) -> None:
    capturado = {}

    def _post_falso(url, headers, json, timeout):
        capturado["url"] = url
        capturado["json"] = json
        return SimpleNamespace(
            status_code=200,
            json=lambda: {"choices": [{"message": {"content": "listo", "tool_calls": None}}]},
        )

    monkeypatch.setattr("app.llm.openrouter_provider.requests.post", _post_falso)

    provider = OpenRouterProvider(api_key="or-falsa", model="deepseek/deepseek-v4-pro-20260813")
    respuesta = provider.generate(
        messages=[Message(role="user", content="hola")], tools=[_TOOL]
    )

    assert respuesta.text == "listo"
    assert respuesta.tool_calls == []
    tool_enviado = capturado["json"]["tools"][0]
    assert tool_enviado["type"] == "function"
    assert tool_enviado["function"]["name"] == "dar_consejos_del_dia"
    assert tool_enviado["function"]["parameters"] == _TOOL["input_schema"]
    assert tool_enviado["function"]["strict"] is True


def test_generate_parsea_tool_calls_de_la_respuesta(monkeypatch) -> None:
    def _post_falso(url, headers, json, timeout):
        return SimpleNamespace(
            status_code=200,
            json=lambda: {
                "choices": [
                    {
                        "message": {
                            "content": None,
                            "tool_calls": [
                                {
                                    "function": {
                                        "name": "dar_consejos_del_dia",
                                        "arguments": '{"consejos": []}',
                                    }
                                }
                            ],
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.llm.openrouter_provider.requests.post", _post_falso)

    provider = OpenRouterProvider(api_key="or-falsa", model="deepseek/deepseek-v4-pro-20260813")
    respuesta = provider.generate(messages=[Message(role="user", content="hola")], tools=[_TOOL])

    assert respuesta.text == ""
    assert len(respuesta.tool_calls) == 1
    assert respuesta.tool_calls[0].name == "dar_consejos_del_dia"
    assert respuesta.tool_calls[0].arguments == {"consejos": []}


def test_generate_error_http_levanta_openrouter_api_error(monkeypatch) -> None:
    def _post_falso(url, headers, json, timeout):
        return SimpleNamespace(status_code=401, text="unauthorized")

    monkeypatch.setattr("app.llm.openrouter_provider.requests.post", _post_falso)

    provider = OpenRouterProvider(api_key="or-falsa", model="deepseek/deepseek-v4-pro-20260813")
    try:
        provider.generate(messages=[Message(role="user", content="hola")])
        assert False, "debería haber levantado OpenRouterAPIError"
    except OpenRouterAPIError:
        pass
