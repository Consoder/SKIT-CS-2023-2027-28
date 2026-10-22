from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError, register_exception_handlers


class _Payload(BaseModel):
    value: int


def _build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom-app-error")
    def boom_app_error():
        raise AppError("something specific went wrong", status_code=404, error_code="not_found")

    @app.get("/boom-unhandled")
    def boom_unhandled():
        raise RuntimeError("leaked internal detail")

    @app.post("/boom-validation")
    def boom_validation(payload: _Payload):
        return payload

    return app


client = TestClient(_build_test_app(), raise_server_exceptions=False)


def test_app_error_returns_structured_response() -> None:
    response = client.get("/boom-app-error")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["message"] == "something specific went wrong"


def test_unhandled_exception_returns_safe_generic_response() -> None:
    response = client.get("/boom-unhandled")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    # must never leak internal exception details to the client
    assert "leaked internal detail" not in response.text


def test_validation_error_returns_structured_response() -> None:
    response = client.post("/boom-validation", json={"value": "not-an-int"})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["details"], list)
