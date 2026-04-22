export default () => ({
  PORT: parseInt(process.env.PORT as string, 10) || 8080,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  s3: {
    bucket: process.env.S3_BUCKET || 'expense-receipts',
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  ai: {
    apiKey: process.env.AI_API_KEY,
  },
  internalApiKey: process.env.INTERNAL_API_KEY,
  confidenceThreshold:
    parseFloat(process.env.CONFIDENCE_THRESHOLD as string) || 0.7,
});
