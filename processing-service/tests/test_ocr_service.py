from unittest.mock import patch

import pytest

from app.services.ocr_service import (
    extract_text,
    extract_text_from_image,
    extract_text_from_pdf,
)


class TestExtractTextFromImage:
    @patch("app.services.ocr_service.pytesseract.image_to_string")
    @patch("app.services.ocr_service.Image.open")
    def test_returns_extracted_text(self, mock_open, mock_ocr):
        mock_ocr.return_value = "  Coffee Shop  \n  $4.50  "
        result = extract_text_from_image(b"fake-image-bytes")
        assert "Coffee Shop" in result
        assert "$4.50" in result

    @patch("app.services.ocr_service.pytesseract.image_to_string")
    @patch("app.services.ocr_service.Image.open")
    def test_empty_text_raises_error(self, mock_open, mock_ocr):
        mock_ocr.return_value = "   "
        with pytest.raises(ValueError, match="No text extracted"):
            extract_text_from_image(b"fake-image-bytes")

    @patch("app.services.ocr_service.Image.open")
    def test_corrupt_file_raises_error(self, mock_open):
        mock_open.side_effect = Exception("Not a valid image")
        with pytest.raises(ValueError, match="Failed to extract text from image"):
            extract_text_from_image(b"corrupt-bytes")


class TestExtractTextFromPdf:
    @patch("app.services.ocr_service.pdfplumber.open")
    def test_returns_extracted_text(self, mock_pdf_open):
        mock_page = mock_pdf_open.return_value.__enter__.return_value.pages[0]
        mock_page.extract_text.return_value = "Invoice #123\nTotal: $25.00"
        result = extract_text_from_pdf(b"fake-pdf-bytes")
        assert "Invoice #123" in result
        assert "Total: $25.00" in result

    @patch("app.services.ocr_service.pdfplumber.open")
    def test_empty_pdf_raises_error(self, mock_pdf_open):
        mock_page = mock_pdf_open.return_value.__enter__.return_value.pages[0]
        mock_page.extract_text.return_value = None
        with pytest.raises(ValueError, match="No text extracted from PDF"):
            extract_text_from_pdf(b"fake-pdf-bytes")

    @patch("app.services.ocr_service.pdfplumber.open")
    def test_corrupt_pdf_raises_error(self, mock_pdf_open):
        mock_pdf_open.side_effect = Exception("Corrupt PDF")
        with pytest.raises(ValueError, match="Failed to extract text from PDF"):
            extract_text_from_pdf(b"corrupt-pdf")


class TestExtractTextDispatcher:
    @patch("app.services.ocr_service.extract_text_from_image")
    def test_dispatches_image_types(self, mock_image):
        mock_image.return_value = "text"
        for ext in ["jpg", "jpeg", "png", "webp", "bmp", "gif"]:
            result = extract_text(b"bytes", ext)
            assert result == "text"
            mock_image.assert_called_with(b"bytes")

    @patch("app.services.ocr_service.extract_text_from_pdf")
    def test_dispatches_pdf(self, mock_pdf):
        mock_pdf.return_value = "pdf text"
        result = extract_text(b"bytes", "pdf")
        assert result == "pdf text"
        mock_pdf.assert_called_with(b"bytes")

    def test_unsupported_file_type_raises_error(self):
        with pytest.raises(ValueError, match="Unsupported file type: txt"):
            extract_text(b"bytes", "txt")

    def test_unsupported_file_type_with_dot_raises_error(self):
        with pytest.raises(ValueError, match="Unsupported file type: xyz"):
            extract_text(b"bytes", ".xyz")
