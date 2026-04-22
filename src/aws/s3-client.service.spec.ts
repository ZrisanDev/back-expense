import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { S3ClientService } from './s3-client.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3ClientService', () => {
  let service: S3ClientService;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue({});

    (S3Client as unknown as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://expense-receipts.s3.localhost/test.jpg?X-Amz-Signature=abc123',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3ClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const s3Keys: Record<string, string> = {
                's3.bucket': 'expense-receipts',
                's3.region': 'us-east-1',
                's3.endpoint': 'http://localhost:4566',
                's3.accessKeyId': 'test-access-key',
                's3.secretAccessKey': 'test-secret-key',
                NODE_ENV: 'development',
              };
              return s3Keys[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3ClientService>(S3ClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // SC-4.1: S3Client is configured with correct endpoint in dev mode
  describe('S3Client configuration', () => {
    it('SC-4.1: should configure S3Client with correct endpoint in dev mode', () => {
      const s3ClientCalls = (S3Client as unknown as jest.Mock).mock.calls;
      expect(s3ClientCalls.length).toBeGreaterThan(0);

      const config = s3ClientCalls[0][0];
      expect(config.region).toBe('us-east-1');
      expect(config.endpoint).toBe('http://localhost:4566');
    });

    it('should configure S3Client with forcePathStyle true in dev mode', () => {
      const s3ClientCalls = (S3Client as unknown as jest.Mock).mock.calls;
      const config = s3ClientCalls[0][0];
      expect(config.forcePathStyle).toBe(true);
    });

    it('should NOT set endpoint in production mode', async () => {
      (S3Client as unknown as jest.Mock).mockClear();

      const prodModule: TestingModule = await Test.createTestingModule({
        providers: [
          S3ClientService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const values: Record<string, string | undefined> = {
                  's3.bucket': 'expense-receipts',
                  's3.region': 'eu-west-1',
                  's3.endpoint': undefined,
                  's3.accessKeyId': 'prod-key',
                  's3.secretAccessKey': 'prod-secret',
                  NODE_ENV: 'production',
                };
                return values[key];
              }),
            },
          },
        ],
      }).compile();

      prodModule.get<S3ClientService>(S3ClientService);

      const s3ClientCalls = (S3Client as unknown as jest.Mock).mock.calls;
      const config = s3ClientCalls[0][0];
      expect(config.endpoint).toBeUndefined();
      expect(config.region).toBe('eu-west-1');
    });
  });

  // SC-2.1 / SC-3.5: generatePresignedPutUrl returns valid URL for allowed MIME types
  describe('generatePresignedPutUrl - allowed MIME types', () => {
    it('SC-2.1: should return a valid URL string for image/jpeg', async () => {
      const url = await service.generatePresignedPutUrl(
        'test.jpg',
        'image/jpeg',
        1024,
      );
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('SC-3.5: should return a valid URL for image/png', async () => {
      const url = await service.generatePresignedPutUrl(
        'test.png',
        'image/png',
        2048,
      );
      expect(typeof url).toBe('string');
    });

    it('SC-3.5: should return a valid URL for application/pdf', async () => {
      const url = await service.generatePresignedPutUrl(
        'doc.pdf',
        'application/pdf',
        5120,
      );
      expect(typeof url).toBe('string');
    });
  });

  // SC-2.2: generatePresignedPutUrl rejects unsupported MIME types
  describe('generatePresignedPutUrl - rejected MIME types', () => {
    it('SC-2.2: should reject text/plain with BadRequestException', async () => {
      await expect(
        service.generatePresignedPutUrl('test.txt', 'text/plain', 1024),
      ).rejects.toThrow(BadRequestException);
    });

    it('SC-2.2: should reject image/gif with BadRequestException', async () => {
      await expect(
        service.generatePresignedPutUrl('test.gif', 'image/gif', 1024),
      ).rejects.toThrow(BadRequestException);
    });

    it('SC-2.2: should reject text/html with BadRequestException', async () => {
      await expect(
        service.generatePresignedPutUrl('test.html', 'text/html', 1024),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // SC-2.3: generatePresignedPutUrl rejects files exceeding max size
  describe('generatePresignedPutUrl - file size validation', () => {
    it('SC-2.3: should reject files exceeding 10MB', async () => {
      const maxBytes = 10 * 1024 * 1024;
      await expect(
        service.generatePresignedPutUrl(
          'large.jpg',
          'image/jpeg',
          maxBytes + 1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept files at exactly 10MB', async () => {
      const maxBytes = 10 * 1024 * 1024;
      const url = await service.generatePresignedPutUrl(
        'max.jpg',
        'image/jpeg',
        maxBytes,
      );
      expect(typeof url).toBe('string');
    });

    it('should accept small files', async () => {
      const url = await service.generatePresignedPutUrl(
        'small.jpg',
        'image/jpeg',
        100,
      );
      expect(typeof url).toBe('string');
    });
  });

  // SC-3.1: generatePresignedGetUrl returns a valid URL string
  // SC-3.2: generatePresignedGetUrl uses configured expiry
  describe('generatePresignedGetUrl', () => {
    it('SC-3.1: should return a valid URL string', async () => {
      const url = await service.generatePresignedGetUrl('test.jpg');
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('SC-3.2: should use default expiry of 300 seconds', async () => {
      await service.generatePresignedGetUrl('test.jpg');
      const callArgs = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBeDefined(); // client is passed
      expect(callArgs[1]).toBeDefined(); // command is passed
      expect(callArgs[2]).toEqual({ expiresIn: 300 });
    });

    it('SC-3.2: should use custom expiry when provided', async () => {
      await service.generatePresignedGetUrl('test.jpg', 600);
      const callArgs = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBeDefined();
      expect(callArgs[1]).toBeDefined();
      expect(callArgs[2]).toEqual({ expiresIn: 600 });
    });
  });

  // SC-5.1: deleteObject calls S3 deleteObjectCommand
  // SC-5.2: deleteObject handles not-found errors gracefully
  describe('deleteObject', () => {
    it('SC-5.1: should call S3 DeleteObjectCommand with correct bucket and key', async () => {
      await service.deleteObject('test.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'expense-receipts',
        Key: 'test.jpg',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('SC-5.1: should resolve without error on successful delete', async () => {
      await expect(service.deleteObject('test.jpg')).resolves.not.toThrow();
    });

    it('SC-5.2: should handle NoSuchKey errors gracefully', async () => {
      const noSuchKeyError = new Error('The specified key does not exist');
      noSuchKeyError.name = 'NoSuchKey';
      mockSend.mockRejectedValue(noSuchKeyError);

      await expect(
        service.deleteObject('nonexistent.jpg'),
      ).resolves.not.toThrow();
    });

    it('SC-5.2: should rethrow non-NoSuchKey errors', async () => {
      const genericError = new Error('Network timeout');
      genericError.name = 'Error';
      mockSend.mockRejectedValue(genericError);

      await expect(service.deleteObject('test.jpg')).rejects.toThrow(
        'Network timeout',
      );
    });
  });
});
