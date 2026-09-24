"""
Structured error handling for the API.

Sprint 3, Task 2 (URL validation & request/response schemas — due 30-09-2026):
every error response, whatever the cause, comes back in one consistent shape
and never leaks internal exception details to the client. This is what keeps
the API safe to expose publicly at scale — unhandled bugs fail closed instead
of echoing stack traces to whoever is calling the endpoint.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for domain errors that should map to a specific HTTP status."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    error_code: str = "bad_request"

    def __init__(self, message: str, *, status_code: int | None = None, error_code: str | None = None) -> None:
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        super().__init__(message)


def build_error_body(error_code: str, message: str, details: object = None) -> dict:
    body: dict = {"error": {"code": error_code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=build_error_body(exc.error_code, exc.message))


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=build_error_body(
            "validation_error",
            "Request validation failed",
            jsonable_encoder(exc.errors()),
        ),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception while processing %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=build_error_body("internal_error", "An unexpected error occurred"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
