import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyGuard } from '../api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: { get: jest.Mock };

  const mockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'INTERNAL_API_KEY') return 'valid-api-key-123';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('REQ-3: X-API-Key authentication', () => {
    it('should throw UnauthorizedException (401) when X-API-Key header is missing', () => {
      const context = mockExecutionContext({});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with "Missing X-API-Key" message', () => {
      const context = mockExecutionContext({});
      expect(() => guard.canActivate(context)).toThrow('Missing X-API-Key header');
    });

    it('should throw ForbiddenException (403) when X-API-Key does not match', () => {
      const context = mockExecutionContext({ 'x-api-key': 'wrong-key' });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with "Invalid API key" message', () => {
      const context = mockExecutionContext({ 'x-api-key': 'wrong-key' });
      expect(() => guard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should return true when X-API-Key matches INTERNAL_API_KEY', () => {
      const context = mockExecutionContext({ 'x-api-key': 'valid-api-key-123' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should read INTERNAL_API_KEY from ConfigService', () => {
      const context = mockExecutionContext({ 'x-api-key': 'valid-api-key-123' });
      guard.canActivate(context);
      expect(configService.get).toHaveBeenCalledWith('INTERNAL_API_KEY');
    });
  });
});
