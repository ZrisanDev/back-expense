import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimestampsToExpense1776814482873 implements MigrationInterface {
  name = 'AddTimestampsToExpense1776814482873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expense" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "created_at"`);
  }
}
