import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  const validDevEnv = {
    NODE_ENV: 'development',
    PORT: '8080',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USER: 'expense_user',
    DATABASE_PASSWORD: 'expense_pass',
    DATABASE_NAME: 'expense_db',
    JWT_SECRET: 'super-secret-key',
    JWT_EXPIRES_IN: '1h',
    REFRESH_TOKEN_SECRET: 'super-secret-refresh',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
  };

  // SC-1.1: All required vars present → validation passes
  describe('SC-1.1: Valid config passes validation', () => {
    it('should validate successfully with all required vars in development', () => {
      const { error } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });

    it('should validate successfully with all required vars in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'a-very-long-refresh-secret-key',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
        INTERNAL_API_KEY: 'a-very-long-internal-api-key',
        PROCESSING_SERVICE_URL: 'https://processing.example.com',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });
  });

  // SC-1.2: Missing required var → fail-fast
  describe('SC-1.2: Missing required var fails', () => {
    it('should fail when DATABASE_HOST is missing', () => {
      const { DATABASE_HOST, ...envWithoutHost } = validDevEnv;
      const { error } = validationSchema.validate(envWithoutHost, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('DATABASE_HOST');
    });

    it('should fail when DATABASE_USER is missing', () => {
      const { DATABASE_USER, ...env } = validDevEnv;
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('DATABASE_USER');
    });

    it('should fail when DATABASE_PASSWORD is missing', () => {
      const { DATABASE_PASSWORD, ...env } = validDevEnv;
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('DATABASE_PASSWORD');
    });

    it('should fail when DATABASE_NAME is missing', () => {
      const { DATABASE_NAME, ...env } = validDevEnv;
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('DATABASE_NAME');
    });

    it('should fail when JWT_SECRET is missing', () => {
      const { JWT_SECRET, ...env } = validDevEnv;
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('JWT_SECRET');
    });
  });

  // SC-1.3: Invalid type → fail-fast
  describe('SC-1.3: Invalid type fails', () => {
    it('should fail when PORT is set to "abc"', () => {
      const env = { ...validDevEnv, PORT: 'abc' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('PORT');
    });

    it('should fail when DATABASE_PORT is set to "not-a-number"', () => {
      const env = { ...validDevEnv, DATABASE_PORT: 'not-a-number' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('DATABASE_PORT');
    });

    it('should fail when CONFIDENCE_THRESHOLD is not a number', () => {
      const env = { ...validDevEnv, CONFIDENCE_THRESHOLD: 'not-a-number' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('CONFIDENCE_THRESHOLD');
    });
  });

  // SC-1.4: Dev mode lenient defaults
  describe('SC-1.4: Dev mode lenient defaults', () => {
    it('should default PORT to 8080 when not set', () => {
      const { PORT, ...envWithoutPort } = validDevEnv;
      const { value, error } = validationSchema.validate(envWithoutPort, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.PORT).toBe(8080);
    });

    it('should default S3_BUCKET to "expense-receipts" when not set', () => {
      const { error, value } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.S3_BUCKET).toBe('expense-receipts');
    });

    it('should default S3_REGION to "us-east-1" when not set', () => {
      const { error, value } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.S3_REGION).toBe('us-east-1');
    });

    it('should default JWT_EXPIRES_IN to "1h" when not set', () => {
      const { JWT_EXPIRES_IN, ...env } = validDevEnv;
      const { value, error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.JWT_EXPIRES_IN).toBe('1h');
    });

    it('should default CONFIDENCE_THRESHOLD to 0.7 when not set', () => {
      const { error, value } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.CONFIDENCE_THRESHOLD).toBe(0.7);
    });

    it('should default NODE_ENV to "development" when not set', () => {
      const { NODE_ENV, ...env } = validDevEnv;
      const { value, error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.NODE_ENV).toBe('development');
    });

    it('should default PROCESSING_SERVICE_URL to "http://localhost:8000" when not set', () => {
      const { error, value } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.PROCESSING_SERVICE_URL).toBe('http://localhost:8000');
    });
  });

  // SC-1.5: Prod mode strict validation — secrets min 16 chars
  describe('SC-1.5: Prod mode strict validation', () => {
    it('should fail when JWT_SECRET is 8 chars in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'shortkey',
        REFRESH_TOKEN_SECRET: 'shortkey-refresh',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
        INTERNAL_API_KEY: 'a-very-long-internal-api-key',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('JWT_SECRET');
    });

    it('should fail when REFRESH_TOKEN_SECRET is 8 chars in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'shortkey',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
        INTERNAL_API_KEY: 'a-very-long-internal-api-key',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('REFRESH_TOKEN_SECRET');
    });

    it('should fail when INTERNAL_API_KEY is too short in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'a-very-long-refresh-secret-key',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
        INTERNAL_API_KEY: 'short',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('INTERNAL_API_KEY');
    });

    it('should allow short secrets in development', () => {
      const devEnv = {
        ...validDevEnv,
        JWT_SECRET: 'short',
        REFRESH_TOKEN_SECRET: 'short',
      };
      const { error } = validationSchema.validate(devEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });
  });

  // SC-1.6: S3 vars optional in dev
  describe('SC-1.6: S3 vars optional in dev', () => {
    it('should pass when S3_ACCESS_KEY_ID is not set in development', () => {
      const { error } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });

    it('should pass when S3_SECRET_ACCESS_KEY is not set in development', () => {
      const { error } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });
  });

  // SC-1.7: S3 vars required in prod
  describe('SC-1.7: S3 vars required in prod', () => {
    it('should fail when S3_ACCESS_KEY_ID is missing in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'a-very-long-refresh-secret-key',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
        INTERNAL_API_KEY: 'a-very-long-internal-api-key',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('S3_ACCESS_KEY_ID');
    });

    it('should fail when S3_SECRET_ACCESS_KEY is missing in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'a-very-long-refresh-secret-key',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        INTERNAL_API_KEY: 'a-very-long-internal-api-key',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('S3_SECRET_ACCESS_KEY');
    });

    it('should fail when INTERNAL_API_KEY is missing in production', () => {
      const prodEnv = {
        ...validDevEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-long-secret-key-for-production',
        REFRESH_TOKEN_SECRET: 'a-very-long-refresh-secret-key',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: 'a-very-long-secret-key-min-16-chars',
      };
      const { error } = validationSchema.validate(prodEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('INTERNAL_API_KEY');
    });
  });

  // SC-1.3 extended: Invalid NODE_ENV
  describe('Invalid NODE_ENV fails', () => {
    it('should fail when NODE_ENV is an invalid value', () => {
      const env = { ...validDevEnv, NODE_ENV: 'staging' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('NODE_ENV');
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('should pass when test environment has all required vars', () => {
      const testEnv = {
        ...validDevEnv,
        NODE_ENV: 'test',
        JWT_SECRET: 'short',
        REFRESH_TOKEN_SECRET: 'short',
      };
      const { error } = validationSchema.validate(testEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });

    it('should reject PORT values outside 1-65535 range', () => {
      const env = { ...validDevEnv, PORT: '99999' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
    });

    it('should reject CONFIDENCE_THRESHOLD outside 0-1 range', () => {
      const env = { ...validDevEnv, CONFIDENCE_THRESHOLD: '1.5' };
      const { error } = validationSchema.validate(env, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
    });

    it('should convert PORT to number', () => {
      const { value, error } = validationSchema.validate(validDevEnv, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(typeof value.PORT).toBe('number');
    });
  });
});
