from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.models.schemas import ProcessingResultPayload
from app.services.backend_service import send_result


def _make_payload(**overrides) -> ProcessingResultPayload:
    defaults = {
        "expenseId": "550e8400-e29b-41d4-a716-446655440000",
        "s3Key": "expenses/550e8400/file.jpg",
        "rawText": "Coffee Shop\n$4.50",
        "structuredJson": {"amount": 4.50, "currency": "USD"},
        "confidence": 0.95,
        "status": "PROCESSED",
        "errorMessage": None,
    }
    defaults.update(overrides)
    return ProcessingResultPayload(**defaults)


@patch("app.services.backend_service.httpx")
def test_successful_post(mock_httpx):
    """Successfully sends result to backend."""
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_response
    mock_httpx.Client.return_value = mock_client

    payload = _make_payload()

    with patch("app.services.backend_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            BACKEND_URL="http://localhost:8080",
            INTERNAL_API_KEY="dev-key",
        )
        send_result(payload)

    mock_client.post.assert_called_once()
    call_args = mock_client.post.call_args
    assert call_args[0][0] == "http://localhost:8080/internal/processing-result"
    assert call_args[1]["headers"]["X-API-Key"] == "dev-key"
    assert call_args[1]["headers"]["Content-Type"] == "application/json"


@patch("app.services.backend_service.httpx")
def test_connection_error_raises(mock_httpx):
    """Connection errors raise ConnectionError."""
    mock_httpx.Client.side_effect = httpx.ConnectError("Connection refused")

    payload = _make_payload()

    with patch("app.services.backend_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            BACKEND_URL="http://localhost:8080",
            INTERNAL_API_KEY="dev-key",
        )
        with pytest.raises(ConnectionError, match="Cannot connect to backend"):
            send_result(payload)


@patch("app.services.backend_service.httpx")
def test_http_error_propagates(mock_httpx):
    """HTTP error responses are propagated."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_response
    mock_httpx.Client.return_value = mock_client

    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server Error", request=MagicMock(), response=mock_response
    )

    payload = _make_payload()

    with patch("app.services.backend_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            BACKEND_URL="http://localhost:8080",
            INTERNAL_API_KEY="dev-key",
        )
        with pytest.raises(httpx.HTTPStatusError):
            send_result(payload)
