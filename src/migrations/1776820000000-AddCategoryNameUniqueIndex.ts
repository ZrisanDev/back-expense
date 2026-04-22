import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryNameUniqueIndex1776820000000 implements MigrationInterface {
  name = 'AddCategoryNameUniqueIndex1776820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_category_user_name" ON "category" ("user_id", "name") WHERE "isDefault" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_category_user_name"`);
  }
}
