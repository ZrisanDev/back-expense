import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const userId = 'user-123';

  beforeEach(async () => {
    const mockService = {
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateProfile', () => {
    it('should call service.update with userId and dto', async () => {
      const dto = { name: 'Updated Name' };
      const updatedUser = { id: userId, name: 'Updated Name' };
      service.update.mockResolvedValue(updatedUser as any);

      const result = await controller.updateProfile(userId, dto);

      expect(service.update).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('removeProfile', () => {
    it('should call service.remove with userId', async () => {
      service.remove.mockResolvedValue({ deleted: true } as any);

      const result = await controller.removeProfile(userId);

      expect(service.remove).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ deleted: true });
    });
  });
});
