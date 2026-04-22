import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { QueryBudgetDto } from './dto/query-budget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Budget } from './entities/budget.entity';

@ApiTags('Budgets')
@ApiBearerAuth('JWT-auth')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create budget' })
  @ApiResponse({ status: 201, description: 'Budget created', type: Budget })
  create(
    @GetUser('id') userId: string,
    @Body() createBudgetDto: CreateBudgetDto,
  ) {
    return this.budgetsService.create(userId, createBudgetDto);
  }

  @Get()
  @ApiOperation({ summary: 'List budgets with utilization' })
  @ApiResponse({ status: 200, description: 'Budgets list with spending info' })
  findAll(@GetUser('id') userId: string, @Query() query: QueryBudgetDto) {
    return this.budgetsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget by ID with utilization' })
  @ApiResponse({ status: 200, description: 'Budget found', type: Budget })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.budgetsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update budget' })
  @ApiResponse({ status: 200, description: 'Budget updated', type: Budget })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, userId, updateBudgetDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete budget' })
  @ApiResponse({ status: 204, description: 'Budget deleted' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.budgetsService.remove(id, userId);
  }
}
