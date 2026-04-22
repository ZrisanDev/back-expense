import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokensAndRoles1719000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add role column to users table
    await queryRunner.query(`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" varchar(10) DEFAULT 'user'
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "token" varchar(255) UNIQUE NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "is_revoked" boolean DEFAULT false,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_token" ON "refresh_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "role"`,
    );
  }
}
