from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.services.s3_service import download_file


@patch("app.services.s3_service.boto3")
def test_successful_download(mock_boto3):
    """Successfully downloads a file from S3."""
    mock_client = MagicMock()
    mock_boto3.client.return_value = mock_client

    mock_body = MagicMock()
    mock_body.read.return_value = b"file-content-bytes"
    mock_client.get_object.return_value = {"Body": mock_body}

    with patch("app.services.s3_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            S3_ENDPOINT="http://localhost:4566",
            S3_REGION="us-east-1",
            S3_BUCKET="expense-receipts",
            S3_ACCESS_KEY_ID="test",
            S3_SECRET_ACCESS_KEY="test",
        )
        result = download_file("expenses/123/file.jpg")

    assert result == b"file-content-bytes"
    mock_client.get_object.assert_called_once_with(
        Bucket="expense-receipts", Key="expenses/123/file.jpg"
    )


@patch("app.services.s3_service.boto3")
def test_nosuchkey_raises_value_error(mock_boto3):
    """S3 NoSuchKey error raises ValueError."""
    mock_client = MagicMock()
    mock_boto3.client.return_value = mock_client

    error_response = {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}}
    mock_client.get_object.side_effect = ClientError(error_response, "GetObject")

    with patch("app.services.s3_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            S3_ENDPOINT="http://localhost:4566",
            S3_REGION="us-east-1",
            S3_BUCKET="expense-receipts",
            S3_ACCESS_KEY_ID="test",
            S3_SECRET_ACCESS_KEY="test",
        )
        with pytest.raises(ValueError, match="S3 object not found"):
            download_file("expenses/nonexistent/file.jpg")


@patch("app.services.s3_service.boto3")
def test_network_error_raises_value_error(mock_boto3):
    """Network/timeout errors raise ValueError."""
    mock_client = MagicMock()
    mock_boto3.client.return_value = mock_client

    mock_client.get_object.side_effect = Exception("Connection timeout")

    with patch("app.services.s3_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            S3_ENDPOINT="http://localhost:4566",
            S3_REGION="us-east-1",
            S3_BUCKET="expense-receipts",
            S3_ACCESS_KEY_ID="test",
            S3_SECRET_ACCESS_KEY="test",
        )
        with pytest.raises(ValueError, match="S3 download failed"):
            download_file("expenses/123/file.jpg")
