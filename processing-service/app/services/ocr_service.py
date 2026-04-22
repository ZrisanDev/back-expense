import io
import logging
from typing import Optional

import pdfplumber
import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_TYPES = {"jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff"}
SUPPORTED_PDF_TYPES = {"pdf"}


def extract_text_from_image(file_bytes: bytes) -> str:
    """Extract text from an image file using Tesseract OCR."""
    try:
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image).strip()
        if not text:
            raise ValueError("No text extracted from image")
        return text
    except Exception as e:
        if "No text extracted" in str(e):
            raise
        logger.error(f"OCR image extraction failed: {e}")
        raise ValueError(f"Failed to extract text from image: {e}")


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file using pdfplumber."""
    try:
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        text = "\n".join(text_parts).strip()
        if not text:
            raise ValueError("No text extracted from PDF")
        return text
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"OCR PDF extraction failed: {e}")
        raise ValueError(f"Failed to extract text from PDF: {e}")


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Dispatch text extraction based on file type.

    Args:
        file_bytes: Raw file bytes.
        file_type: File extension (e.g. 'jpg', 'pdf').

    Returns:
        Extracted text string.

    Raises:
        ValueError: If file type is unsupported or extraction fails.
    """
    extension = file_type.lower().lstrip(".")

    if extension in SUPPORTED_IMAGE_TYPES:
        return extract_text_from_image(file_bytes)
    elif extension in SUPPORTED_PDF_TYPES:
        return extract_text_from_pdf(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {extension}")
