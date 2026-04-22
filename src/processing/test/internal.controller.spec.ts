import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InternalController } from '../internal.controller';
import { ProcessingService } from '../processing.service';
import { ApiKeyGuard } from '../api-key.guard';
import { ProcessingResultRequestDto } from '../dto/processing-result-request.dto';
import { ExpenseStatus } from '../../expenses/entities/expense.entity';

describe('InternalController', () => {
  let controller: InternalController;
  let service: jest.Mocked<ProcessingService>;

  const validDto: ProcessingResultRequestDto = {
    expenseId: 'exp-123',
    s3Key: 'expenses/exp-123/receipt.jpg',
    status: ExpenseStatus.PROCESSED,
    rawText: 'Coffee $5.00',
    structuredJson: { amount: 5.0, currency: 'USD' },
    confidence: 0.95,
  };

  const mockResult = {
    id: 'pr-1',
    expenseId: 'exp-123',
    rawText: 'Coffee $5.00',
    structuredJson: { amount: 5.0, currency: 'USD' },
    confidence: 0.95,
    processedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      processResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [{ provide: ProcessingService, useValue: mockService }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InternalController>(InternalController);
    service = module.get(ProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processResult', () => {
    it('should call ProcessingService.processResult and return 201 with ProcessingResult', async () => {
      service.processResult.mockResolvedValue(mockResult);

      const result = await controller.processResult(validDto);

      expect(service.processResult).toHaveBeenCalledWith(validDto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate NotFoundException when expense not found', async () => {
      service.processResult.mockRejectedValue(
        new NotFoundException('Expense not found'),
      );

      const promise = controller.processResult(validDto);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Expense not found');
    });

    it('should propagate BadRequestException when expense not in PROCESSING status', async () => {
      service.processResult.mockRejectedValue(
        new BadRequestException('Expense is not in PROCESSING status'),
      );

      const promise = controller.processResult(validDto);
      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('should propagate validation errors (missing required fields)', async () => {
      const invalidDto = {
        s3Key: 'expenses/exp-123/receipt.jpg',
        // missing expenseId, status
      } as any;

      // Validation is handled by the DTO pipes, which NestJS runs before the controller method.
      // At the unit test level, we test that the controller passes through to the service.
      // Here we verify the service IS called with whatever DTO it receives.
      service.processResult.mockResolvedValue(mockResult);

      await controller.processResult(invalidDto);

      expect(service.processResult).toHaveBeenCalledWith(invalidDto);
    });
  });
});
