import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { File, FileType } from './entities/file.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { S3ClientService } from '../aws/s3-client.service';
import { UploadUrlRequestDto } from './dto/upload-url.request.dto';

const MIME_TO_FILE_TYPE: Record<string, FileType> = {
  'image/jpeg': FileType.JPEG,
  'image/png': FileType.PNG,
  'application/pdf': FileType.PDF,
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(File) private readonly fileRepository: Repository<File>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly s3ClientService: S3ClientService,
  ) {}

  async generateUploadUrl(
    userId: string,
    expenseId: string,
    dto: UploadUrlRequestDto,
  ): Promise<{ uploadUrl: string; file: File }> {
    await this.findExpenseOrThrow(expenseId, userId);

    const fileType = MIME_TO_FILE_TYPE[dto.contentType];
    const ext = MIME_TO_EXT[dto.contentType];
    const uuid = randomUUID();
    const s3Key = `expenses/${expenseId}/${uuid}.${ext}`;

    const uploadUrl = await this.s3ClientService.generatePresignedPutUrl(
      s3Key,
      dto.contentType,
      dto.fileSize,
    );

    const file = this.fileRepository.create({
      expenseId,
      s3Key,
      fileUrl: s3Key,
      fileType,
    });

    const saved = await this.fileRepository.save(file);

    return { uploadUrl, file: saved };
  }

  async findByExpense(userId: string, expenseId: string): Promise<File[]> {
    await this.findExpenseOrThrow(expenseId, userId);

    return this.fileRepository.find({ where: { expenseId } });
  }

  async generateDownloadUrl(
    userId: string,
    expenseId: string,
    fileId: string,
  ): Promise<{ downloadUrl: string }> {
    await this.findExpenseOrThrow(expenseId, userId);

    const file = await this.fileRepository.findOne({
      where: { id: fileId, expenseId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const downloadUrl =
      await this.s3ClientService.generatePresignedGetUrl(file.s3Key);

    return { downloadUrl };
  }

  async remove(
    userId: string,
    expenseId: string,
    fileId: string,
  ): Promise<{ deleted: true }> {
    await this.findExpenseOrThrow(expenseId, userId);

    const file = await this.fileRepository.findOne({
      where: { id: fileId, expenseId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    try {
      await this.s3ClientService.deleteObject(file.s3Key);
    } catch (error) {
      this.logger.error(
        `Failed to delete S3 object ${file.s3Key}: ${(error as Error).message}`,
      );
    }

    await this.fileRepository.remove(file);

    return { deleted: true };
  }

  async deleteFilesForExpense(expenseId: string): Promise<void> {
    const files = await this.fileRepository.find({
      where: { expenseId },
    });

    for (const file of files) {
      try {
        await this.s3ClientService.deleteObject(file.s3Key);
      } catch (error) {
        this.logger.error(
          `Failed to delete S3 object ${file.s3Key}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async findExpenseOrThrow(
    expenseId: string,
    userId: string,
  ): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId, userId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }
}
