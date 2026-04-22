import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { File, FileType } from './entities/file.entity';
import { UploadUrlRequestDto } from './dto/upload-url.request.dto';

describe('FilesController', () => {
  let controller: FilesController;
  let service: jest.Mocked<FilesService>;

  const userId = 'user-123';
  const expenseId = 'exp-456';
  const fileId = 'file-789';

  const mockFile: Partial<File> = {
    id: fileId,
    expenseId,
    s3Key: `expenses/${expenseId}/${fileId}.jpg`,
    fileUrl: `expenses/${expenseId}/${fileId}.jpg`,
    fileType: FileType.JPEG,
    uploadedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      generateUploadUrl: jest.fn(),
      findByExpense: jest.fn(),
      generateDownloadUrl: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: mockService }],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    service = module.get(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    const dto: UploadUrlRequestDto = {
      contentType: 'image/jpeg',
      fileSize: 1024,
    };

    it('should call service.generateUploadUrl with userId, expenseId, and dto', async () => {
      const uploadResult = {
        uploadUrl: 'https://presigned-url.put',
        file: mockFile,
      };
      service.generateUploadUrl.mockResolvedValue(uploadResult as any);

      const result = await controller.generateUploadUrl(
        userId,
        expenseId,
        dto,
      );

      expect(service.generateUploadUrl).toHaveBeenCalledWith(
        userId,
        expenseId,
        dto,
      );
      expect(result).toEqual(uploadResult);
    });

    it('should propagate NotFoundException when expense not found', async () => {
      service.generateUploadUrl.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(
        controller.generateUploadUrl(userId, 'nonexistent-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for invalid MIME type', async () => {
      service.generateUploadUrl.mockRejectedValue(
        new BadRequestException('Unsupported file type: text/html'),
      );

      await expect(
        controller.generateUploadUrl(userId, expenseId, {
          contentType: 'text/html',
          fileSize: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException for file too large', async () => {
      service.generateUploadUrl.mockRejectedValue(
        new BadRequestException(
          'File size exceeds maximum allowed size of 10MB',
        ),
      );

      await expect(
        controller.generateUploadUrl(userId, expenseId, {
          contentType: 'image/jpeg',
          fileSize: 11000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByExpense', () => {
    it('should call service.findByExpense with userId and expenseId', async () => {
      const files = [mockFile];
      service.findByExpense.mockResolvedValue(files as any);

      const result = await controller.findByExpense(userId, expenseId);

      expect(service.findByExpense).toHaveBeenCalledWith(userId, expenseId);
      expect(result).toEqual(files);
    });

    it('should return empty array when expense has no files', async () => {
      service.findByExpense.mockResolvedValue([]);

      const result = await controller.findByExpense(userId, expenseId);

      expect(result).toEqual([]);
    });

    it('should propagate NotFoundException when expense not found', async () => {
      service.findByExpense.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(
        controller.findByExpense(userId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateDownloadUrl', () => {
    it('should call service.generateDownloadUrl with userId, expenseId, and fileId', async () => {
      const downloadResult = { downloadUrl: 'https://presigned-url.get' };
      service.generateDownloadUrl.mockResolvedValue(downloadResult);

      const result = await controller.generateDownloadUrl(
        userId,
        expenseId,
        fileId,
      );

      expect(service.generateDownloadUrl).toHaveBeenCalledWith(
        userId,
        expenseId,
        fileId,
      );
      expect(result).toEqual(downloadResult);
    });

    it('should propagate NotFoundException when file not found', async () => {
      service.generateDownloadUrl.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      await expect(
        controller.generateDownloadUrl(
          userId,
          expenseId,
          'nonexistent-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when expense not found', async () => {
      service.generateDownloadUrl.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(
        controller.generateDownloadUrl(
          userId,
          'nonexistent-id',
          fileId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call service.remove with userId, expenseId, and fileId', async () => {
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(userId, expenseId, fileId);

      expect(service.remove).toHaveBeenCalledWith(userId, expenseId, fileId);
      expect(result).toEqual({ deleted: true });
    });

    it('should propagate NotFoundException when file not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      await expect(
        controller.remove(userId, expenseId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when expense not found', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      await expect(
        controller.remove(userId, 'nonexistent-id', fileId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
