#!/bin/bash
set -e

# -------------------------------------------------------
# init-localstack.sh
# Creates the S3 bucket for receipt storage in LocalStack.
# Idempotent: safe to run multiple times without errors.
#
# Usage:
#   ./docker/init-localstack.sh
#   S3_BUCKET=my-custom-bucket ./docker/init-localstack.sh
# -------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source .env for defaults — existing environment variables take precedence
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    # Only export if the variable is not already set in the environment
    key="${line%%=*}"
    [[ -z "${!key+x}" ]] && export "$line"
  done < "$PROJECT_ROOT/.env"
  set +a
fi

BUCKET_NAME="${S3_BUCKET:-expense-receipts}"
ENDPOINT="${S3_ENDPOINT:-http://localhost:4566}"

echo "========================================"
echo " LocalStack S3 Init"
echo "========================================"
echo " Endpoint : $ENDPOINT"
echo " Bucket   : $BUCKET_NAME"
echo "========================================"

# --- awslocal (preferred) ---
create_with_awslocal() {
  if awslocal s3 mb "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo "✓ Bucket '${BUCKET_NAME}' created"
  else
    echo "✓ Bucket '${BUCKET_NAME}' already exists (ok)"
  fi
}

# --- aws CLI fallback ---
create_with_aws() {
  if aws --endpoint-url="$ENDPOINT" s3 mb "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo "✓ Bucket '${BUCKET_NAME}' created"
  else
    echo "✓ Bucket '${BUCKET_NAME}' already exists (ok)"
  fi
}

# --- curl fallback (when no AWS CLI available) ---
create_with_curl() {
  echo "Note: awslocal/aws not found — using curl"
  local http_code

  # Check if bucket already exists (HEAD request)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X HEAD "${ENDPOINT}/${BUCKET_NAME}" 2>/dev/null) || true

  if [ "$http_code" = "200" ]; then
    echo "✓ Bucket '${BUCKET_NAME}' already exists (ok)"
    return 0
  fi

  # Create the bucket (PUT request)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "${ENDPOINT}/${BUCKET_NAME}" 2>/dev/null) || true

  if [ "$http_code" = "200" ]; then
    echo "✓ Bucket '${BUCKET_NAME}' created"
  elif [ "$http_code" = "409" ]; then
    echo "✓ Bucket '${BUCKET_NAME}' already exists (ok)"
  else
    echo "✗ Failed to create bucket '${BUCKET_NAME}' (HTTP ${http_code})"
    return 1
  fi
}

# --- Execute with the best available method ---
if command -v awslocal &> /dev/null; then
  create_with_awslocal
elif command -v aws &> /dev/null; then
  create_with_aws
else
  create_with_curl
fi

echo "Done."
