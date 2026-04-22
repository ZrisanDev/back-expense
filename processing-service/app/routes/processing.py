import logging
from pathlib import PurePosixPath

from fastapi import APIRouter

from app.models.schemas import ProcessRequest, ProcessResponse, ProcessingResultPayload
from app.services import ai_service, backend_service, ocr_service, s3_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/process", response_model=ProcessResponse, status_code=202)
async def process_receipt(request: ProcessRequest) -> ProcessResponse:
    """Process a receipt file: download from S3 → OCR → AI → send result to backend.

    Returns 202 Accepted immediately after processing completes.
    All errors are caught and sent to backend as FAILED status.
    """
    expense_id = request.expenseId
    s3_key = request.s3Key

    logger.info("Starting processing for expense %s, s3Key=%s", expense_id, s3_key)

    try:
        # Step 1: Download file from S3
        logger.info("[Step 1/3] Downloading file from S3: %s", s3_key)
        file_bytes = s3_service.download_file(s3_key)
        logger.info(
            "[Step 1/3] Downloaded %d bytes from S3", len(file_bytes)
        )

        # Step 2: Extract text via OCR
        logger.info("[Step 2/3] Running OCR on file")
        file_ext = PurePosixPath(s3_key).suffix.lstrip(".")
        raw_text = ocr_service.extract_text(file_bytes, file_ext)
        logger.info("[Step 2/3] OCR extracted %d characters", len(raw_text))

        # Step 3: Parse with AI
        logger.info("[Step 3/3] Parsing receipt with AI")
        ai_result = await ai_service.parse_receipt(raw_text)
        logger.info(
            "[Step 3/3] AI result: status=%s, confidence=%s",
            ai_result["status"],
            ai_result.get("confidence"),
        )

        # Build and send result to backend
        payload = ProcessingResultPayload(
            expenseId=expense_id,
            s3Key=s3_key,
            rawText=raw_text,
            structuredJson=ai_result.get("structuredJson"),
            confidence=ai_result.get("confidence"),
            status=ai_result["status"],
            errorMessage=ai_result.get("errorMessage"),
        )

        backend_service.send_result(payload)

        return ProcessResponse(
            message=f"Processing completed for expense {expense_id}",
            status="accepted",
        )

    except ValueError as e:
        # OCR or S3 error
        logger.error("Processing failed for expense %s: %s", expense_id, e)
        _send_failed(expense_id, s3_key, str(e))
        return ProcessResponse(
            message=f"Processing failed for expense {expense_id}: {e}",
            status="error",
        )

    except Exception as e:
        # Unexpected error
        logger.error(
            "Unexpected error processing expense %s: %s", expense_id, e, exc_info=True
        )
        _send_failed(expense_id, s3_key, str(e))
        return ProcessResponse(
            message=f"Processing failed for expense {expense_id}: {e}",
            status="error",
        )


def _send_failed(expense_id: str, s3_key: str, error_message: str) -> None:
    """Send a FAILED status to the backend. Errors are logged but not propagated."""
    try:
        payload = ProcessingResultPayload(
            expenseId=expense_id,
            s3Key=s3_key,
            status="FAILED",
            errorMessage=error_message,
        )
        backend_service.send_result(payload)
    except Exception as backend_error:
        logger.error(
            "Failed to send FAILED status to backend for expense %s: %s",
            expense_id,
            backend_error,
        )
