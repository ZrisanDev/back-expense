import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  private generateTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    const refreshTokenExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const refreshToken = uuidv4();

    const expiresAt = new Date();
    if (refreshTokenExpiresIn.endsWith('d')) {
      expiresAt.setDate(
        expiresAt.getDate() + parseInt(refreshTokenExpiresIn),
      );
    } else if (refreshTokenExpiresIn.endsWith('h')) {
      expiresAt.setHours(
        expiresAt.getHours() + parseInt(refreshTokenExpiresIn),
      );
    }

    return { accessToken, refreshToken, expiresAt };
  }

  async register(registerDto: RegisterDto) {
    try {
      const user = await this.usersService.create(registerDto);
      const { accessToken, refreshToken, expiresAt } =
        this.generateTokens(user);

      await this.saveRefreshToken(user.id, refreshToken, expiresAt);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken, expiresAt } =
      this.generateTokens(user);

    await this.saveRefreshToken(user.id, refreshToken, expiresAt);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshTokenValue: string) {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue, isRevoked: false },
      relations: ['user'],
    });

    if (!token || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke the old refresh token (rotation)
    token.isRevoked = true;
    await this.refreshTokenRepository.save(token);

    const user = token.user;
    const { accessToken, refreshToken, expiresAt } =
      this.generateTokens(user);

    await this.saveRefreshToken(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(refreshTokenValue: string) {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue, isRevoked: false },
    });

    if (token) {
      token.isRevoked = true;
      await this.refreshTokenRepository.save(token);
    }

    return { message: 'Logged out successfully' };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ) {
    const rt = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
    });
    await this.refreshTokenRepository.save(rt);
  }

  /**
   * Cleanup expired and revoked tokens. Call from a cron/scheduler.
   */
  async cleanupExpiredTokens() {
    const result = await this.refreshTokenRepository.delete({
      isRevoked: true,
    });

    const expiredResult = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(
      `Cleaned up ${result.affected} revoked + ${expiredResult.affected} expired refresh tokens`,
    );
  }
}
