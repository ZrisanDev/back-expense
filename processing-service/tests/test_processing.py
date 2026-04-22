from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.fixture
def mock_s3_download():
    with patch("app.routes.processing.s3_service.download_file") as mock:
        mock.return_value = b"fake-image-bytes"
        yield mock


@pytest.fixture
def mock_ocr():
    with patch("app.routes.processing.ocr_service.extract_text") as mock:
        mock.return_value = "Coffee Shop\nTotal: $4.50"
        yield mock


@pytest.fixture
def mock_ai():
    with patch("app.routes.processing.ai_service.parse_receipt") as mock:
        mock.return_value = {
            "structuredJson": {
                "amount": 4.50,
                "currency": "USD",
                "date": "2024-01-15",
                "vendor": "Coffee Shop",
                "category": "food",
                "confidence": 0.95,
            },
            "confidence": 0.95,
            "status": "PROCESSED",
            "errorMessage": None,
        }
        yield mock


@pytest.fixture
def mock_backend():
    with patch("app.routes.processing.backend_service.send_result") as mock:
        yield mock


@pytest.mark.asyncio
async def test_happy_path(mock_s3_download, mock_ocr, mock_ai, mock_backend):
    """Happy path: S3 → OCR → AI → backend, returns 202."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/process",
            json={
                "expenseId": "550e8400-e29b-41d4-a716-446655440000",
                "s3Key": "expenses/550e8400/file.jpg",
            },
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "accepted"
    mock_s3_download.assert_called_once_with("expenses/550e8400/file.jpg")
    mock_ocr.assert_called_once()
    mock_ai.assert_called_once_with("Coffee Shop\nTotal: $4.50")
    mock_backend.assert_called_once()


@pytest.mark.asyncio
async def test_ocr_failure_sends_failed(mock_s3_download, mock_ocr, mock_backend):
    """OCR failure sends FAILED status to backend."""
    mock_ocr.side_effect = ValueError("Unsupported file type: txt")

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/process",
            json={
                "expenseId": "550e8400-e29b-41d4-a716-446655440000",
                "s3Key": "expenses/550e8400/document.txt",
            },
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "error"
    # Backend should be called with FAILED status
    call_args = mock_backend.call_args[0][0]
    assert call_args.status == "FAILED"
    assert "Unsupported file type" in call_args.errorMessage


@pytest.mark.asyncio
async def test_ai_failure_sends_failed(mock_s3_download, mock_ocr, mock_backend):
    """AI failure sends FAILED status to backend."""
    with patch("app.routes.processing.ai_service.parse_receipt") as mock_ai:
        mock_ai.return_value = {
            "structuredJson": None,
            "confidence": None,
            "status": "FAILED",
            "errorMessage": "All 3 AI attempts failed",
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/process",
                json={
                    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
                    "s3Key": "expenses/550e8400/file.jpg",
                },
            )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "accepted"
    call_args = mock_backend.call_args[0][0]
    assert call_args.status == "FAILED"


@pytest.mark.asyncio
async def test_backend_failure_is_caught(mock_s3_download, mock_ocr):
    """If backend send fails, the error is logged but doesn't crash."""
    with patch("app.routes.processing.ai_service.parse_receipt") as mock_ai, \
         patch("app.routes.processing.backend_service.send_result") as mock_backend:
        mock_ai.return_value = {
            "structuredJson": {"amount": 10},
            "confidence": 0.9,
            "status": "PROCESSED",
            "errorMessage": None,
        }
        mock_backend.side_effect = ConnectionError("Cannot connect to backend")

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/process",
                json={
                    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
                    "s3Key": "expenses/550e8400/file.jpg",
                },
            )

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_s3_failure_sends_failed(mock_backend):
    """S3 download failure sends FAILED status to backend."""
    with patch("app.routes.processing.s3_service.download_file") as mock_s3:
        mock_s3.side_effect = ValueError("S3 object not found")

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/process",
                json={
                    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
                    "s3Key": "expenses/550e8400/missing.jpg",
                },
            )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "error"
    call_args = mock_backend.call_args[0][0]
    assert call_args.status == "FAILED"
    assert "S3 object not found" in call_args.errorMessage
