from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    """Request body for the /process endpoint."""

    expenseId: str = Field(..., description="Expense UUID")
    s3Key: str = Field(..., description="S3 object key")


class ProcessResponse(BaseModel):
    """Response body for the /process endpoint."""

    message: str
    status: Literal["accepted", "error"]


class ProcessingResultPayload(BaseModel):
    """Payload sent to the NestJS backend POST /internal/processing-result."""

    expenseId: str
    s3Key: str
    rawText: str | None = None
    structuredJson: dict[str, Any] | None = None
    confidence: float | None = None
    status: Literal["PROCESSED", "NEEDS_REVIEW", "FAILED"]
    errorMessage: str | None = None
