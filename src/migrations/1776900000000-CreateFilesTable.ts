import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFilesTable1776900000000 implements MigrationInterface {
  name = 'CreateFilesTable1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'file',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'expense_id',
            type: 'uuid',
          },
          {
            name: 's3_key',
            type: 'varchar',
          },
          {
            name: 'file_url',
            type: 'varchar',
          },
          {
            name: 'file_type',
            type: 'enum',
            enum: ['jpeg', 'png', 'pdf'],
          },
          {
            name: 'uploaded_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_file_expense_id',
            columnNames: ['expense_id'],
            referencedTableName: 'expense',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'file',
      new TableIndex({
        name: 'IDX_files_expense_id',
        columnNames: ['expense_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('file');
  }
}
