from unittest.mock import MagicMock, patch

import pytest
from openai import AuthenticationError, APIStatusError

from app.services.ai_service import parse_receipt


def _make_mock_client(response_content: str, side_effect: Exception | None = None):
    """Create a mock OpenAI client with a configurable response."""
    client = MagicMock()

    if side_effect:
        client.chat.completions.create.side_effect = side_effect
    else:
        mock_choice = MagicMock()
        mock_message = MagicMock()
        mock_message.content = response_content
        mock_choice.message = mock_message
        client.chat.completions.create.return_value.choices = [mock_choice]

    return client


@pytest.mark.asyncio
async def test_successful_parsing():
    """Valid JSON response with high confidence returns PROCESSED."""
    response_json = '{"amount": 25.50, "currency": "USD", "date": "2024-01-15", "vendor": "Coffee Shop", "category": "food", "confidence": 0.95}'
    client = _make_mock_client(response_content=response_json)

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("some receipt text", client=client)

    assert result["status"] == "PROCESSED"
    assert result["structuredJson"]["amount"] == 25.50
    assert result["confidence"] == 0.95
    assert result["errorMessage"] is None


@pytest.mark.asyncio
async def test_markdown_fenced_json_still_parses():
    """JSON wrapped in ``` fences should still be parsed."""
    response_json = '```json\n{"amount": 10.0, "currency": "ARS", "date": "2024-03-01", "vendor": "Farmacia", "category": "health", "confidence": 0.9}\n```'
    client = _make_mock_client(response_content=response_json)

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "PROCESSED"
    assert result["structuredJson"]["vendor"] == "Farmacia"


@pytest.mark.asyncio
async def test_invalid_json_returns_needs_review():
    """Non-JSON response returns NEEDS_REVIEW."""
    client = _make_mock_client(response_content="This is not JSON at all!")

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "NEEDS_REVIEW"
    assert result["structuredJson"] is None
    assert "invalid JSON" in result["errorMessage"]


@pytest.mark.asyncio
async def test_low_confidence_returns_needs_review():
    """Confidence below threshold returns NEEDS_REVIEW."""
    response_json = '{"amount": 25.50, "currency": "USD", "date": "2024-01-15", "vendor": "Shop", "category": "food", "confidence": 0.3}'
    client = _make_mock_client(response_content=response_json)

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "NEEDS_REVIEW"
    assert result["structuredJson"] is not None
    assert result["confidence"] == 0.3
    assert "below threshold" in result["errorMessage"]


@pytest.mark.asyncio
async def test_auth_error_fails_immediately():
    """401 authentication errors should fail immediately without retry."""
    client = _make_mock_client(
        response_content="",
        side_effect=AuthenticationError(
            response=MagicMock(status_code=401),
            message="Invalid API key",
        ),
    )

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "FAILED"
    assert "authentication" in result["errorMessage"].lower()
    # Should only have been called once (no retries)
    assert client.chat.completions.create.call_count == 1


@pytest.mark.asyncio
async def test_rate_limit_retries_then_fails():
    """429 rate limit errors should retry up to max_retries times."""
    error = APIStatusError(
        response=MagicMock(status_code=429),
        message="Rate limit exceeded",
    )
    client = _make_mock_client(response_content="", side_effect=error)

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=3,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "FAILED"
    assert client.chat.completions.create.call_count == 3
    assert "All 3 AI attempts failed" in result["errorMessage"]


@pytest.mark.asyncio
async def test_empty_response_retries_then_fails():
    """Empty AI response should retry."""
    client = _make_mock_client(response_content="")

    with patch("app.services.ai_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            AI_MODEL="gpt-4o-mini",
            MAX_AI_RETRIES=2,
            CONFIDENCE_THRESHOLD=0.7,
        )
        result = await parse_receipt("receipt", client=client)

    assert result["status"] == "FAILED"
    assert client.chat.completions.create.call_count == 2
