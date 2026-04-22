import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '../entities/file.entity';

export class FileResponseDto {
  @ApiProperty({ description: 'File UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'S3 object key', example: 'expenses/550e8400-e29b-41d4-a716-446655440000/abc123.jpg' })
  s3Key: string;

  @ApiProperty({ description: 'File URL', example: 'https://expense-receipts.s3.amazonaws.com/expenses/...' })
  fileUrl: string;

  @ApiProperty({ description: 'File type', enum: FileType })
  fileType: FileType;

  @ApiProperty({ description: 'Upload timestamp', example: '2026-04-22T12:00:00.000Z' })
  uploadedAt: Date;
}
