import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from 'src/categories/entities/category.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { User } from 'src/users/entities/user.entity';
import { Budget } from 'src/budgets/entities/budget.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [User, Expense, Category, Budget],
        synchronize: configService.get<boolean>('database.synchronize'),
        extra: {
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
