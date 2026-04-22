import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHealth: jest.fn().mockResolvedValue({
              status: 'ok',
              timestamp: '2026-01-01T00:00:00.000Z',
              services: { database: 'ok' },
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.health();
      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        services: { database: 'ok' },
      });
      expect(appService.getHealth).toHaveBeenCalled();
    });
  });
});
