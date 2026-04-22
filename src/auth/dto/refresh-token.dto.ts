import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'a1b2c3d4-e5f6-...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
