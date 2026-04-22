import asyncio
import json
import logging
from typing import Any

from openai import (
    APIError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    OpenAI,
)

from app.config import get_settings
from app.utils.prompts import RECEIPT_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)


def _parse_ai_response(content: str) -> tuple[dict[str, Any] | None, str]:
    """Parse AI response content, stripping markdown fences if present.

    Returns:
        Tuple of (parsed_json_or_none, raw_content).
    """
    text = content.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        data = json.loads(text)
        return data, text
    except json.JSONDecodeError:
        return None, text


def _validate_ai_response(data: dict[str, Any]) -> bool:
    """Validate that the AI response contains required fields with correct types."""
    required_fields = {
        "amount": (int, float),
        "currency": str,
        "date": str,
        "vendor": str,
        "category": str,
        "confidence": (int, float),
    }

    for field, expected_type in required_fields.items():
        value = data.get(field)
        if value is None:
            continue
        if not isinstance(value, expected_type):
            return False

    # Validate specific constraints
    amount = data.get("amount")
    if amount is not None and not (isinstance(amount, (int, float)) and amount > 0):
        return False

    confidence = data.get("confidence")
    if confidence is not None and not (
        isinstance(confidence, (int, float)) and 0.0 <= confidence <= 1.0
    ):
        return False

    return True


async def parse_receipt(
    raw_text: str,
    client: OpenAI | None = None,
) -> dict[str, Any]:
    """Parse receipt text using OpenAI and return structured data with status.

    Returns dict with:
        - structuredJson: parsed receipt data or None
        - confidence: float or None
        - status: "PROCESSED" | "NEEDS_REVIEW" | "FAILED"
        - errorMessage: str or None
    """
    settings = get_settings()
    model = settings.AI_MODEL
    max_retries = settings.MAX_AI_RETRIES

    if client is None:
        client = OpenAI(api_key=settings.AI_API_KEY)

    prompt = RECEIPT_EXTRACTION_PROMPT.format(raw_text=raw_text)

    last_error: str | None = None

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a receipt data extraction assistant. Respond only with valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=500,
            )

            content = response.choices[0].message.content
            if not content:
                last_error = "Empty response from AI"
                continue

            parsed, raw = _parse_ai_response(content)

            if parsed is None:
                # Invalid JSON — return NEEDS_REVIEW immediately (don't retry)
                logger.warning("AI returned invalid JSON: %s", raw[:200])
                return {
                    "structuredJson": None,
                    "confidence": None,
                    "status": "NEEDS_REVIEW",
                    "errorMessage": "AI returned invalid JSON",
                }

            if not _validate_ai_response(parsed):
                logger.warning("AI returned invalid response structure: %s", parsed)
                return {
                    "structuredJson": None,
                    "confidence": None,
                    "status": "NEEDS_REVIEW",
                    "errorMessage": "AI response has invalid field types",
                }

            confidence = parsed.get("confidence", 0.0)

            if confidence < settings.CONFIDENCE_THRESHOLD:
                return {
                    "structuredJson": parsed,
                    "confidence": confidence,
                    "status": "NEEDS_REVIEW",
                    "errorMessage": f"Confidence {confidence} below threshold {settings.CONFIDENCE_THRESHOLD}",
                }

            return {
                "structuredJson": parsed,
                "confidence": confidence,
                "status": "PROCESSED",
                "errorMessage": None,
            }

        except AuthenticationError as e:
            # Auth errors fail immediately — no retry
            logger.error("AI authentication failed: %s", e)
            return {
                "structuredJson": None,
                "confidence": None,
                "status": "FAILED",
                "errorMessage": f"AI authentication failed: {e}",
            }

        except (APITimeoutError, APIStatusError) as e:
            last_error = str(e)
            status_code = getattr(e, "status_code", None)

            if status_code == 401:
                # Auth error — fail immediately
                logger.error("AI authentication failed (401): %s", e)
                return {
                    "structuredJson": None,
                    "confidence": None,
                    "status": "FAILED",
                    "errorMessage": f"AI authentication failed: {e}",
                }

            logger.warning(
                "AI request failed (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                e,
            )

            if attempt < max_retries - 1:
                # Exponential backoff: 1s, 2s, 4s
                backoff = 2**attempt
                await asyncio.sleep(backoff)

        except Exception as e:
            last_error = str(e)
            logger.error(
                "Unexpected AI error (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                e,
            )
            if attempt < max_retries - 1:
                backoff = 2**attempt
                await asyncio.sleep(backoff)

    # All retries exhausted
    return {
        "structuredJson": None,
        "confidence": None,
        "status": "FAILED",
        "errorMessage": f"All {max_retries} AI attempts failed. Last error: {last_error}",
    }
