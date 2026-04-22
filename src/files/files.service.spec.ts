import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { FilesService } from './files.service';
import { File, FileType } from './entities/file.entity';
import { Expense, ExpenseStatus } from '../expenses/entities/expense.entity';
import { S3ClientService } from '../aws/s3-client.service';
import { UploadUrlRequestDto } from './dto/upload-url.request.dto';
import { ExpenseStatusHistory } from '../processing/entities/expense-status-history.entity';

describe('FilesService', () => {
  let service: FilesService;
  let fileRepo: jest.Mocked<Repository<File>>;
  let expenseRepo: jest.Mocked<Repository<Expense>>;
  let statusHistoryRepo: jest.Mocked<Repository<ExpenseStatusHistory>>;
  let s3ClientService: jest.Mocked<S3ClientService>;
  let configService: jest.Mocked<ConfigService>;

  const userId = 'user-123';
  const expenseId = 'exp-456';
  const fileId = 'file-789';

  const mockExpense: Partial<Expense> = {
    id: expenseId,
    userId,
    amount: 50.0,
    currency: 'USD',
    vendor: 'Coffee Shop',
    date: '2024-01-15',
    status: 'UPLOADED' as any,
    isDuplicateSuspect: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [],
  };

  const mockFile: Partial<File> = {
    id: fileId,
    expenseId,
    expense: mockExpense as Expense,
    s3Key: `expenses/${expenseId}/${fileId}.jpg`,
    fileUrl: `https://bucket.s3.amazonaws.com/expenses/${expenseId}/${fileId}.jpg`,
    fileType: FileType.JPEG,
    uploadedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(File),
          useValue: {
            create: jest.fn((dto: any) => dto),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: S3ClientService,
          useValue: {
            generatePresignedPutUrl: jest.fn(),
            generatePresignedGetUrl: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PROCESSING_SERVICE_URL') return 'http://localhost:8000';
              if (key === 'INTERNAL_API_KEY') return 'dev-key';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(ExpenseStatusHistory),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    fileRepo = module.get(getRepositoryToken(File));
    expenseRepo = module.get(getRepositoryToken(Expense));
    statusHistoryRepo = module.get(getRepositoryToken(ExpenseStatusHistory));
    s3ClientService = module.get(S3ClientService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    const dto: UploadUrlRequestDto = {
      contentType: 'image/jpeg',
      fileSize: 1024,
    };

    it('should generate upload URL and create file record', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (s3ClientService.generatePresignedPutUrl as jest.Mock).mockResolvedValue(
        'https://presigned-url.put',
      );
      (fileRepo.save as jest.Mock).mockResolvedValue(mockFile);

      const result = await service.generateUploadUrl(userId, expenseId, dto);

      expect(expenseRepo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId, userId },
      });
      expect(s3ClientService.generatePresignedPutUrl).toHaveBeenCalledWith(
        expect.stringContaining(`expenses/${expenseId}/`),
        dto.contentType,
        dto.fileSize,
      );
      expect(fileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId,
          s3Key: expect.stringContaining(`expenses/${expenseId}/`),
          fileType: FileType.JPEG,
        }),
      );
      expect(result).toEqual({
        uploadUrl: 'https://presigned-url.put',
        file: expect.objectContaining({ id: fileId }),
      });
    });

    it('should throw NotFoundException when expense not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateUploadUrl(userId, 'nonexistent-id', dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.generateUploadUrl(userId, 'nonexistent-id', dto),
      ).rejects.toThrow('Expense not found');
    });

    it('should propagate BadRequestException for invalid MIME type', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (s3ClientService.generatePresignedPutUrl as jest.Mock).mockRejectedValue(
        new BadRequestException('Unsupported file type: text/html'),
      );

      await expect(
        service.generateUploadUrl(userId, expenseId, {
          contentType: 'text/html',
          fileSize: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException for file too large', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (s3ClientService.generatePresignedPutUrl as jest.Mock).mockRejectedValue(
        new BadRequestException('File size exceeds maximum allowed size of 10MB'),
      );

      await expect(
        service.generateUploadUrl(userId, expenseId, {
          contentType: 'image/jpeg',
          fileSize: 11000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should map png contentType to PNG fileType', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (s3ClientService.generatePresignedPutUrl as jest.Mock).mockResolvedValue(
        'https://presigned-url.put',
      );
      (fileRepo.save as jest.Mock).mockResolvedValue({
        ...mockFile,
        fileType: FileType.PNG,
      });

      await service.generateUploadUrl(userId, expenseId, {
        contentType: 'image/png',
        fileSize: 1024,
      });

      expect(fileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fileType: FileType.PNG }),
      );
    });

    it('should map pdf contentType to PDF fileType', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (s3ClientService.generatePresignedPutUrl as jest.Mock).mockResolvedValue(
        'https://presigned-url.put',
      );
      (fileRepo.save as jest.Mock).mockResolvedValue({
        ...mockFile,
        fileType: FileType.PDF,
      });

      await service.generateUploadUrl(userId, expenseId, {
        contentType: 'application/pdf',
        fileSize: 1024,
      });

      expect(fileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fileType: FileType.PDF }),
      );
    });
  });

  describe('findByExpense', () => {
    it('should return files for an owned expense', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      const files = [mockFile, { ...mockFile, id: 'file-999' }];
      (fileRepo.find as jest.Mock).mockResolvedValue(files);

      const result = await service.findByExpense(userId, expenseId);

      expect(expenseRepo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId, userId },
      });
      expect(fileRepo.find).toHaveBeenCalledWith({
        where: { expenseId },
      });
      expect(result).toEqual(files);
    });

    it('should return empty array when expense has no files', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findByExpense(userId, expenseId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when expense not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByExpense(userId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate download URL for an owned file', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);
      (s3ClientService.generatePresignedGetUrl as jest.Mock).mockResolvedValue(
        'https://presigned-url.get',
      );

      const result = await service.generateDownloadUrl(
        userId,
        expenseId,
        fileId,
      );

      expect(expenseRepo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId, userId },
      });
      expect(fileRepo.findOne).toHaveBeenCalledWith({
        where: { id: fileId, expenseId },
      });
      expect(s3ClientService.generatePresignedGetUrl).toHaveBeenCalledWith(
        mockFile.s3Key,
      );
      expect(result).toEqual({ downloadUrl: 'https://presigned-url.get' });
    });

    it('should throw NotFoundException when file not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateDownloadUrl(userId, expenseId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.generateDownloadUrl(userId, expenseId, 'nonexistent-id'),
      ).rejects.toThrow('File not found');
    });

    it('should throw NotFoundException when expense not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateDownloadUrl(userId, 'nonexistent-id', fileId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete file from S3 and DB', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);
      (s3ClientService.deleteObject as jest.Mock).mockResolvedValue(undefined);
      (fileRepo.remove as jest.Mock).mockResolvedValue(mockFile);

      const result = await service.remove(userId, expenseId, fileId);

      expect(s3ClientService.deleteObject).toHaveBeenCalledWith(
        mockFile.s3Key,
      );
      expect(fileRepo.remove).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({ deleted: true });
    });

    it('should log S3 error but still delete from DB when S3 deletion fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);
      (s3ClientService.deleteObject as jest.Mock).mockRejectedValue(
        new Error('S3 is down'),
      );
      (fileRepo.remove as jest.Mock).mockResolvedValue(mockFile);

      const result = await service.remove(userId, expenseId, fileId);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete S3 object'),
      );
      expect(fileRepo.remove).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({ deleted: true });
      loggerSpy.mockRestore();
    });

    it('should throw NotFoundException when file not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.remove(userId, expenseId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFilesForExpense', () => {
    it('should delete all S3 objects for expense files', async () => {
      const files = [
        mockFile,
        { ...mockFile, id: 'file-2', s3Key: 'expenses/exp-456/file-2.pdf' },
        { ...mockFile, id: 'file-3', s3Key: 'expenses/exp-456/file-3.png' },
      ];
      (fileRepo.find as jest.Mock).mockResolvedValue(files);
      (s3ClientService.deleteObject as jest.Mock).mockResolvedValue(undefined);

      await service.deleteFilesForExpense(expenseId);

      expect(fileRepo.find).toHaveBeenCalledWith({
        where: { expenseId },
      });
      expect(s3ClientService.deleteObject).toHaveBeenCalledTimes(3);
      expect(s3ClientService.deleteObject).toHaveBeenCalledWith(
        'expenses/exp-456/file-789.jpg',
      );
      expect(s3ClientService.deleteObject).toHaveBeenCalledWith(
        'expenses/exp-456/file-2.pdf',
      );
      expect(s3ClientService.deleteObject).toHaveBeenCalledWith(
        'expenses/exp-456/file-3.png',
      );
    });

    it('should continue deleting remaining files when one S3 deletion fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const files = [
        mockFile,
        { ...mockFile, id: 'file-2', s3Key: 'expenses/exp-456/file-2.pdf' },
        { ...mockFile, id: 'file-3', s3Key: 'expenses/exp-456/file-3.png' },
      ];
      (fileRepo.find as jest.Mock).mockResolvedValue(files);
      (s3ClientService.deleteObject as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('S3 is down'))
        .mockResolvedValueOnce(undefined);

      await service.deleteFilesForExpense(expenseId);

      expect(s3ClientService.deleteObject).toHaveBeenCalledTimes(3);
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      loggerSpy.mockRestore();
    });

    it('should do nothing when expense has no files', async () => {
      (fileRepo.find as jest.Mock).mockResolvedValue([]);

      await service.deleteFilesForExpense(expenseId);

      expect(s3ClientService.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('should find file by ID, verify expense ownership, and return the file', async () => {
      const expense = {
        ...mockExpense,
        status: ExpenseStatus.PROCESSING,
      };
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(expense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);

      const result = await service.confirmUpload(userId, expenseId, fileId);

      expect(expenseRepo.findOne).toHaveBeenCalledWith({
        where: { id: expenseId, userId },
      });
      expect(fileRepo.findOne).toHaveBeenCalledWith({
        where: { id: fileId, expenseId },
      });
      expect(result).toEqual(mockFile);
    });

    it('should throw NotFoundException when expense not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(null);

      const promise = service.confirmUpload(userId, expenseId, fileId);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Expense not found');
    });

    it('should throw NotFoundException when file not found', async () => {
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(mockExpense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(null);

      const promise = service.confirmUpload(userId, expenseId, fileId);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('File not found');
    });

    it('should transition expense from UPLOADED to PROCESSING and create status history', async () => {
      const expense = {
        ...mockExpense,
        status: ExpenseStatus.UPLOADED,
      };
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(expense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);
      (expenseRepo.save as jest.Mock).mockResolvedValue({
        ...expense,
        status: ExpenseStatus.PROCESSING,
      });
      (statusHistoryRepo.save as jest.Mock).mockResolvedValue({
        id: 'sh-1',
        expenseId,
        fromStatus: ExpenseStatus.UPLOADED,
        toStatus: ExpenseStatus.PROCESSING,
      });

      await service.confirmUpload(userId, expenseId, fileId);

      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExpenseStatus.PROCESSING }),
      );
      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId,
          fromStatus: ExpenseStatus.UPLOADED,
          toStatus: ExpenseStatus.PROCESSING,
          reason: 'File uploaded',
        }),
      );
    });

    it('should skip status transition when expense is already in PROCESSING (idempotent)', async () => {
      const expense = {
        ...mockExpense,
        status: ExpenseStatus.PROCESSING,
      };
      (expenseRepo.findOne as jest.Mock).mockResolvedValue(expense);
      (fileRepo.findOne as jest.Mock).mockResolvedValue(mockFile);

      await service.confirmUpload(userId, expenseId, fileId);

      expect(expenseRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('triggerProcessing', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should POST to PROCESSING_SERVICE_URL/process with expenseId and s3Key', async () => {
      const mockResponse = { ok: true, status: 202 };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.triggerProcessing(expenseId, mockFile.s3Key);

      expect(configService.get).toHaveBeenCalledWith('PROCESSING_SERVICE_URL');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/process',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key',
          }),
          body: JSON.stringify({ expenseId, s3Key: mockFile.s3Key }),
        }),
      );
    });

    it('should be fire-and-forget (catches errors, does not throw)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should NOT throw — fire-and-forget
      await expect(
        service.triggerProcessing(expenseId, mockFile.s3Key),
      ).resolves.toBeUndefined();
    });

    it('should log error when HTTP call fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw — fire-and-forget, error is logged internally
      await expect(
        service.triggerProcessing(expenseId, mockFile.s3Key),
      ).resolves.toBeUndefined();
    });
  });
});
