import logging

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)


def download_file(s3_key: str) -> bytes:
    """Download a file from S3 and return its bytes.

    Args:
        s3_key: The S3 object key.

    Returns:
        File contents as bytes.

    Raises:
        ValueError: If the file does not exist or download fails.
    """
    settings = get_settings()

    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    )

    try:
        logger.info("Downloading file from S3: %s", s3_key)
        response = s3_client.get_object(Bucket=settings.S3_BUCKET, Key=s3_key)
        data = response["Body"].read()
        logger.info("Successfully downloaded %d bytes from %s", len(data), s3_key)
        return data
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        if error_code == "NoSuchKey":
            logger.error("S3 object not found: %s", s3_key)
            raise ValueError(f"S3 object not found: {s3_key}")
        logger.error("S3 download error for %s: %s", s3_key, e)
        raise ValueError(f"S3 download failed: {e}")
    except Exception as e:
        logger.error("Unexpected S3 download error for %s: %s", s3_key, e)
        raise ValueError(f"S3 download failed: {e}")
