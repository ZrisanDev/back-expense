import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1776814172469 implements MigrationInterface {
  name = 'InitialSchema1776814172469';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "icon" character varying, "isDefault" boolean NOT NULL DEFAULT false, "user_id" uuid, CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expense_status_enum" AS ENUM('UPLOADED', 'PROCESSING', 'PROCESSED', 'NEEDS_REVIEW', 'FAILED', 'APPROVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expense" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "amount" double precision NOT NULL, "currency" character varying NOT NULL DEFAULT 'USD', "category_id" uuid, "vendor" character varying, "date" date NOT NULL, "status" "public"."expense_status_enum" NOT NULL DEFAULT 'UPLOADED', "is_duplicate_suspect" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_edd925b450e13ea36197c9590fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying, "defaultCurrency" character varying NOT NULL DEFAULT 'USD', "confidenceThreshold" double precision NOT NULL DEFAULT '0.8', CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD CONSTRAINT "FK_6562e564389d0600e6e243d9604" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense" ADD CONSTRAINT "FK_8aed1abe692b31639ccde1b0416" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense" ADD CONSTRAINT "FK_478b68a9314d8787fb3763a2298" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expense" DROP CONSTRAINT "FK_478b68a9314d8787fb3763a2298"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense" DROP CONSTRAINT "FK_8aed1abe692b31639ccde1b0416"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" DROP CONSTRAINT "FK_6562e564389d0600e6e243d9604"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "expense"`);
    await queryRunner.query(`DROP TYPE "public"."expense_status_enum"`);
    await queryRunner.query(`DROP TABLE "category"`);
  }
}
