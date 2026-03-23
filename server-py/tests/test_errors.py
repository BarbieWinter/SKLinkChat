from fastapi import Request

from app.main import create_app


def test_unhandled_error_uses_global_handler():
    app = create_app()

    @app.get("/__test/unhandled")
    async def raise_unhandled(request: Request):
        request.state.request_id = "req-unhandled"
        raise RuntimeError("boom")

    from fastapi.testclient import TestClient

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/__test/unhandled")

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "request_id" in response.json()
