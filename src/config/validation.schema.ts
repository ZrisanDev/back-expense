import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(8080),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(1).required(),
  }),

  JWT_EXPIRES_IN: Joi.string().default('1h'),

  REFRESH_TOKEN_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(1).required(),
  }),

  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().optional(),

  S3_BUCKET: Joi.string().default('expense-receipts'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ENDPOINT: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().forbidden(),
    otherwise: Joi.string().optional(),
  }),

  S3_ACCESS_KEY_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),

  S3_SECRET_ACCESS_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional(),
  }),

  INTERNAL_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional(),
  }),

  AI_API_KEY: Joi.string().optional(),

  CONFIDENCE_THRESHOLD: Joi.number().min(0).max(1).default(0.7),

  PROCESSING_SERVICE_URL: Joi.string()
    .uri()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().required(),
      otherwise: Joi.string().default('http://localhost:8000'),
    }),
}).unknown(true);
