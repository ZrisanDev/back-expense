import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  const userId = 'user-123';
  const email = 'test@example.com';
  const password = 'password123';

  const mockUser: Partial<User> = {
    id: userId,
    email,
    passwordHash: 'hashed-password',
    name: 'Test User',
    defaultCurrency: 'USD',
    confidenceThreshold: 0.8,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a user with hashed password', async () => {
      const dto = { email, password, name: 'Test User' };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (repo.create as jest.Mock).mockReturnValue({
        ...dto,
        passwordHash: 'hashed-password',
      });
      (repo.save as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.create(dto as any);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        passwordHash: 'hashed-password',
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto = { email, password };
      (repo.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(dto as any)).rejects.toThrow(
        'Email already in use',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail(email);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findByEmail('nonexistent@example.com')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByEmail('nonexistent@example.com')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('findOneById', () => {
    it('should return a user by id', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOneById(userId);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOneById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneById('nonexistent-id')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('update', () => {
    it('should call repository.update with id and dto', () => {
      const dto = { name: 'Updated Name' };
      (repo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = service.update(userId, dto);

      expect(repo.update).toHaveBeenCalledWith(userId, dto);
    });
  });

  describe('remove', () => {
    it('should call repository.delete with id', () => {
      (repo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = service.remove(userId);

      expect(repo.delete).toHaveBeenCalledWith(userId);
    });
  });
});
