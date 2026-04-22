import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { File, FileType } from './entities/file.entity';
import { Expense, ExpenseStatus } from '../expenses/entities/expense.entity';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';
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
    @InjectRepository(ExpenseStatusHistory)
    private readonly statusHistoryRepository: Repository<ExpenseStatusHistory>,
    private readonly s3ClientService: S3ClientService,
    private readonly configService: ConfigService,
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

  async confirmUpload(
    userId: string,
    expenseId: string,
    fileId: string,
  ): Promise<File> {
    const expense = await this.findExpenseOrThrow(expenseId, userId);

    const file = await this.fileRepository.findOne({
      where: { id: fileId, expenseId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Auto-transition UPLOADED → PROCESSING (idempotent)
    if (expense.status === ExpenseStatus.UPLOADED) {
      expense.status = ExpenseStatus.PROCESSING;
      await this.expenseRepository.save(expense);

      const statusHistory = new ExpenseStatusHistory();
      statusHistory.expenseId = expenseId;
      statusHistory.fromStatus = ExpenseStatus.UPLOADED;
      statusHistory.toStatus = ExpenseStatus.PROCESSING;
      statusHistory.reason = 'File uploaded';
      await this.statusHistoryRepository.save(statusHistory);
    }

    return file;
  }

  async triggerProcessing(expenseId: string, s3Key: string): Promise<void> {
    const processingServiceUrl = this.configService.get<string>(
      'PROCESSING_SERVICE_URL',
    );
    const apiKey = this.configService.get<string>('INTERNAL_API_KEY');

    fetch(`${processingServiceUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ expenseId, s3Key }),
    })
      .then(() => {
        this.logger.log(
          `Processing triggered for expense ${expenseId} with key ${s3Key}`,
        );
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to trigger processing for expense ${expenseId}: ${error.message}`,
          error.stack,
        );
      });
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
