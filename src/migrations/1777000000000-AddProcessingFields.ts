import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingFields1777000000000 implements MigrationInterface {
  name = 'AddProcessingFields1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE expense
        ADD COLUMN "processing_started_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        ADD COLUMN "retry_count" INTEGER DEFAULT 0 NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE expense
        DROP COLUMN "retry_count",
        DROP COLUMN "processing_started_at"
    `);
  }
}
