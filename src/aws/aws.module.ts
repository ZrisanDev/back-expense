import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { S3ClientService } from './s3-client.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3ClientService],
  exports: [S3ClientService],
})
export class AwsModule {}
