import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateProcessingTables1776910000000 implements MigrationInterface {
  name = 'CreateProcessingTables1776910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'processing_result',
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
            name: 'raw_text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'structured_json',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'confidence',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            name: 'FK_processing_result_expense_id',
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
      'processing_result',
      new TableIndex({
        name: 'IDX_processing_result_expense_id',
        columnNames: ['expense_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'expense_status_history',
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
            name: 'from_status',
            type: 'varchar',
          },
          {
            name: 'to_status',
            type: 'varchar',
          },
          {
            name: 'changed_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            name: 'FK_expense_status_history_expense_id',
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
      'expense_status_history',
      new TableIndex({
        name: 'IDX_expense_status_history_expense_id',
        columnNames: ['expense_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('expense_status_history');
    await queryRunner.dropTable('processing_result');
  }
}
