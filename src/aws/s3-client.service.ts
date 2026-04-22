import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_URL_EXPIRY_SECONDS = 300; // 5 minutes

@Injectable()
export class S3ClientService {
  private readonly logger = new Logger(S3ClientService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>(
      's3.bucket',
      'expense-receipts',
    );
    const region = this.configService.get<string>('s3.region', 'us-east-1');
    const endpoint = this.configService.get<string>('s3.endpoint');
    const accessKeyId = this.configService.get<string>('s3.accessKeyId');
    const secretAccessKey =
      this.configService.get<string>('s3.secretAccessKey');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isDev = nodeEnv !== 'production';

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
    };

    if (isDev && endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);

    this.logger.log(
      `S3Client initialized — bucket: ${this.bucket}, region: ${region}, endpoint: ${endpoint ?? 'AWS default'}`,
    );
  }

  async generatePresignedPutUrl(
    key: string,
    contentType: string,
    fileSize: number,
  ): Promise<string> {
    this.validateMimeType(contentType);
    this.validateFileSize(fileSize);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: DEFAULT_URL_EXPIRY_SECONDS,
    });
  }

  async generatePresignedGetUrl(
    key: string,
    expiresIn: number = DEFAULT_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'NoSuchKey') {
        this.logger.warn(`Object not found during delete: ${key}`);
        return;
      }
      throw error;
    }
  }

  private validateMimeType(contentType: string): void {
    if (
      !ALLOWED_MIME_TYPES.includes(
        contentType as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException(
        `Unsupported file type: ${contentType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
  }

  private validateFileSize(fileSize: number): void {
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      const maxMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxMB}MB`,
      );
    }
  }
}
