import logging

import httpx

from app.config import get_settings
from app.models.schemas import ProcessingResultPayload

logger = logging.getLogger(__name__)


def send_result(payload: ProcessingResultPayload) -> None:
    """Send processing result to the NestJS backend.

    Args:
        payload: The processing result payload.

    Raises:
        ConnectionError: If the backend is unreachable.
        httpx.HTTPStatusError: If the backend returns an error status.
    """
    settings = get_settings()

    url = f"{settings.BACKEND_URL}/internal/processing-result"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": settings.INTERNAL_API_KEY,
    }

    try:
        logger.info(
            "Sending processing result to backend: expenseId=%s, status=%s",
            payload.expenseId,
            payload.status,
        )

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                url,
                json=payload.model_dump(exclude_none=True),
                headers=headers,
            )
            response.raise_for_status()

        logger.info(
            "Successfully sent result to backend: expenseId=%s, status=%d",
            payload.expenseId,
            response.status_code,
        )

    except httpx.ConnectError as e:
        logger.error("Failed to connect to backend at %s: %s", url, e)
        raise ConnectionError(f"Cannot connect to backend at {url}: {e}")
    except httpx.HTTPStatusError as e:
        logger.error(
            "Backend returned error status %d for expenseId=%s: %s",
            e.response.status_code,
            payload.expenseId,
            e.response.text,
        )
        raise
    except httpx.RequestError as e:
        logger.error("Network error sending result to backend: %s", e)
        raise ConnectionError(f"Network error sending result to backend: {e}")
