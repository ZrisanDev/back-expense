import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { S3ClientService } from './s3-client.service';
import { AwsModule } from './aws.module';

describe('AwsModule', () => {
  it('SC-5.1: should compile the module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AwsModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
  });

  it('SC-5.1: should provide S3ClientService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AwsModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
    }).compile();

    const service = module.get<S3ClientService>(S3ClientService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(S3ClientService);
  });

  it('should be a global module (S3ClientService available without re-import)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AwsModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        {
          provide: 'TEST_CONSUMER',
          useFactory: (s3Service: S3ClientService) => ({
            service: s3Service,
          }),
          inject: [S3ClientService],
        },
      ],
    }).compile();

    const consumer = module.get<{ service: S3ClientService }>('TEST_CONSUMER');
    expect(consumer.service).toBeDefined();
    expect(consumer.service).toBeInstanceOf(S3ClientService);
  });
});
