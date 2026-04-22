import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (apiKey !== expectedKey) {
      throw new ForbiddenException('Invalid API key');
    }

    return true;
  }
}
