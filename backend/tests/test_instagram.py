from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.instagram import decodificar_state
from app.services.instagram_metrics import _actualizar_racha
from helpers import registrar_usuario

client = TestClient(app)


def _crear_negocio(headers: dict[str, str]) -> int:
    negocio = client.post(
        "/businesses", json={"nombre": "Negocio Instagram", "giro": "ropa"}, headers=headers
    ).json()
    return negocio["id"]


def _conectar_cuenta_de_prueba(headers: dict[str, str], monkeypatch, business_id: int):
    monkeypatch.setattr(settings, "instagram_app_id", "test-app-id")
    monkeypatch.setattr(settings, "instagram_app_secret", "test-app-secret")
    connect = client.get(f"/businesses/{business_id}/instagram/connect", headers=headers)
    state = connect.json()["url"].split("state=")[1]
    monkeypatch.setattr("app.services.instagram.intercambiar_code_por_token", lambda code: "short-token")
    monkeypatch.setattr(
        "app.services.instagram.obtener_token_larga_duracion",
        lambda short_token: (
            "long-token",
            datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=60),
        ),
    )
    monkeypatch.setattr(
        "app.services.instagram.obtener_perfil", lambda access_token: ("17841400000", "mi_negocio")
    )
    return client.get(
        "/integrations/instagram/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )


def _query_del_redirect(respuesta) -> dict[str, str]:
    """El callback siempre redirige a `elasesor://instagram-connected?...` —
    devuelve los query params de esa URL de destino."""
    assert respuesta.status_code == 307
    destino = urlparse(respuesta.headers["location"])
    assert destino.scheme == "elasesor"
    return {k: v[0] for k, v in parse_qs(destino.query).items()}


def test_connect_sin_configurar_da_503(monkeypatch) -> None:
    monkeypatch.setattr(settings, "instagram_app_id", None)
    monkeypatch.setattr(settings, "instagram_app_secret", None)
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.get(f"/businesses/{business_id}/instagram/connect", headers=headers)
    assert respuesta.status_code == 503


def test_connect_devuelve_url_con_state_valido(monkeypatch) -> None:
    monkeypatch.setattr(settings, "instagram_app_id", "test-app-id")
    monkeypatch.setattr(settings, "instagram_app_secret", "test-app-secret")
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.get(f"/businesses/{business_id}/instagram/connect", headers=headers)
    assert respuesta.status_code == 200
    url = respuesta.json()["url"]
    assert url.startswith("https://www.instagram.com/oauth/authorize?")
    assert "client_id=test-app-id" in url

    state = url.split("state=")[1]
    assert decodificar_state(state) == business_id


def test_connect_de_negocio_ajeno_da_404(monkeypatch) -> None:
    monkeypatch.setattr(settings, "instagram_app_id", "test-app-id")
    monkeypatch.setattr(settings, "instagram_app_secret", "test-app-secret")
    headers_dueno = registrar_usuario(client)
    business_id = _crear_negocio(headers_dueno)

    headers_otro = registrar_usuario(client)
    respuesta = client.get(f"/businesses/{business_id}/instagram/connect", headers=headers_otro)
    assert respuesta.status_code == 404


def test_callback_con_state_invalido_redirige_con_error() -> None:
    respuesta = client.get(
        "/integrations/instagram/callback",
        params={"code": "x", "state": "invalido"},
        follow_redirects=False,
    )
    assert _query_del_redirect(respuesta)["status"] == "error"


def test_callback_con_error_de_meta_redirige_con_error() -> None:
    respuesta = client.get(
        "/integrations/instagram/callback",
        params={"error": "access_denied"},
        follow_redirects=False,
    )
    assert _query_del_redirect(respuesta)["status"] == "error"


def test_callback_completo_conecta_la_cuenta(monkeypatch) -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)
    callback = _conectar_cuenta_de_prueba(headers, monkeypatch, business_id)
    assert _query_del_redirect(callback) == {"status": "ok", "username": "mi_negocio"}

    cuenta = client.get(f"/businesses/{business_id}/instagram", headers=headers)
    assert cuenta.status_code == 200
    assert cuenta.json()["username"] == "mi_negocio"
    assert cuenta.json()["racha_actual"] == 0


def test_obtener_cuenta_sin_conectar_da_404() -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.get(f"/businesses/{business_id}/instagram", headers=headers)
    assert respuesta.status_code == 404


def test_desconectar_borra_la_cuenta(monkeypatch) -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)
    _conectar_cuenta_de_prueba(headers, monkeypatch, business_id)

    borrar = client.delete(f"/businesses/{business_id}/instagram", headers=headers)
    assert borrar.status_code == 204

    respuesta = client.get(f"/businesses/{business_id}/instagram", headers=headers)
    assert respuesta.status_code == 404


def test_metricas_sin_conectar_da_404() -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.get(f"/businesses/{business_id}/instagram/metrics", headers=headers)
    assert respuesta.status_code == 404


def test_sync_sin_conectar_da_404() -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.post(f"/businesses/{business_id}/instagram/sync", headers=headers)
    assert respuesta.status_code == 404


def test_sync_guarda_metricas_y_sube_la_racha(monkeypatch) -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)
    _conectar_cuenta_de_prueba(headers, monkeypatch, business_id)

    monkeypatch.setattr(
        "app.services.instagram_metrics.obtener_metricas_insights",
        lambda instagram_user_id, access_token: {"reach": 120, "accounts_engaged": 8, "views": 300},
    )
    monkeypatch.setattr(
        "app.services.instagram_metrics.obtener_conteo_seguidores", lambda access_token: 42
    )
    monkeypatch.setattr(
        "app.services.instagram_metrics.publico_contenido_hoy", lambda access_token, hoy: True
    )
    monkeypatch.setattr(
        "app.services.instagram_posts.obtener_publicaciones_recientes", lambda access_token, limit=25: []
    )

    respuesta = client.post(f"/businesses/{business_id}/instagram/sync", headers=headers)
    assert respuesta.status_code == 200
    data = respuesta.json()
    assert data["reach"] == 120
    assert data["accounts_engaged"] == 8
    assert data["views"] == 300
    assert data["followers_count"] == 42
    assert data["publico_contenido"] is True
    assert data["fecha"] == date.today().isoformat()

    cuenta = client.get(f"/businesses/{business_id}/instagram", headers=headers).json()
    assert cuenta["racha_actual"] == 1
    assert cuenta["racha_maxima"] == 1

    historial = client.get(f"/businesses/{business_id}/instagram/metrics", headers=headers)
    assert historial.status_code == 200
    assert len(historial.json()) == 1

    # Sincronizar de nuevo el mismo día no debe duplicar la racha ni la fila.
    respuesta_otra_vez = client.post(f"/businesses/{business_id}/instagram/sync", headers=headers)
    assert respuesta_otra_vez.status_code == 200
    cuenta_otra_vez = client.get(f"/businesses/{business_id}/instagram", headers=headers).json()
    assert cuenta_otra_vez["racha_actual"] == 1
    assert len(client.get(f"/businesses/{business_id}/instagram/metrics", headers=headers).json()) == 1


def test_racha_sube_en_dias_consecutivos() -> None:
    hoy = date(2026, 8, 24)
    ayer = hoy - timedelta(days=1)

    class CuentaFalsa:
        racha_actual = 3
        racha_maxima = 3
        ultima_fecha_publicacion = ayer

    cuenta = CuentaFalsa()
    _actualizar_racha(cuenta, hoy, publico_hoy=True)
    assert cuenta.racha_actual == 4
    assert cuenta.racha_maxima == 4
    assert cuenta.ultima_fecha_publicacion == hoy


def test_racha_se_corta_si_se_salta_un_dia() -> None:
    hoy = date(2026, 8, 24)
    hace_tres_dias = hoy - timedelta(days=3)

    class CuentaFalsa:
        racha_actual = 5
        racha_maxima = 5
        ultima_fecha_publicacion = hace_tres_dias

    cuenta = CuentaFalsa()
    _actualizar_racha(cuenta, hoy, publico_hoy=False)
    assert cuenta.racha_actual == 0
    assert cuenta.racha_maxima == 5


def test_racha_no_se_corta_el_mismo_dia_sin_publicar_de_nuevo() -> None:
    hoy = date(2026, 8, 24)

    class CuentaFalsa:
        racha_actual = 1
        racha_maxima = 1
        ultima_fecha_publicacion = hoy

    cuenta = CuentaFalsa()
    _actualizar_racha(cuenta, hoy, publico_hoy=False)
    assert cuenta.racha_actual == 1


def test_patrones_sin_conectar_da_404() -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)

    respuesta = client.get(f"/businesses/{business_id}/instagram/patterns", headers=headers)
    assert respuesta.status_code == 404


def test_sync_guarda_publicaciones_y_arma_patrones_por_tipo(monkeypatch) -> None:
    headers = registrar_usuario(client)
    business_id = _crear_negocio(headers)
    _conectar_cuenta_de_prueba(headers, monkeypatch, business_id)

    monkeypatch.setattr(
        "app.services.instagram_metrics.obtener_metricas_insights",
        lambda instagram_user_id, access_token: {"reach": 10, "accounts_engaged": 1, "views": 20},
    )
    monkeypatch.setattr("app.services.instagram_metrics.obtener_conteo_seguidores", lambda access_token: 1)
    monkeypatch.setattr(
        "app.services.instagram_metrics.publico_contenido_hoy", lambda access_token, hoy: False
    )

    publicaciones = [
        {"id": "media-1", "media_type": "IMAGE", "timestamp": "2026-08-20T10:00:00+0000"},
        {"id": "media-2", "media_type": "IMAGE", "timestamp": "2026-08-21T10:00:00+0000"},
        {"id": "media-3", "media_type": "VIDEO", "timestamp": "2026-08-22T10:00:00+0000"},
    ]
    insights_por_media = {
        "media-1": {"reach": 100, "likes": 10, "comments": 1, "saved": 2},
        "media-2": {"reach": 200, "likes": 20, "comments": 3, "saved": 4},
        "media-3": {"reach": 500, "likes": 50, "comments": 5, "saved": 10},
    }
    monkeypatch.setattr(
        "app.services.instagram_posts.obtener_publicaciones_recientes",
        lambda access_token, limit=25: publicaciones,
    )
    monkeypatch.setattr(
        "app.services.instagram_posts.obtener_insights_de_publicacion",
        lambda media_id, access_token: insights_por_media[media_id],
    )

    respuesta = client.post(f"/businesses/{business_id}/instagram/sync", headers=headers)
    assert respuesta.status_code == 200

    patrones = client.get(f"/businesses/{business_id}/instagram/patterns", headers=headers)
    assert patrones.status_code == 200
    por_tipo = {p["media_type"]: p for p in patrones.json()}

    assert por_tipo["IMAGE"]["cantidad"] == 2
    assert por_tipo["IMAGE"]["reach_promedio"] == 150
    assert por_tipo["IMAGE"]["likes_promedio"] == 15

    assert por_tipo["VIDEO"]["cantidad"] == 1
    assert por_tipo["VIDEO"]["reach_promedio"] == 500

    # Sincronizar de nuevo no debe duplicar filas (mismo media_id).
    client.post(f"/businesses/{business_id}/instagram/sync", headers=headers)
    patrones_otra_vez = client.get(f"/businesses/{business_id}/instagram/patterns", headers=headers).json()
    assert sum(p["cantidad"] for p in patrones_otra_vez) == 3
