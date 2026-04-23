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
  HttpStatus,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Expense } from './entities/expense.entity';

@ApiTags('Expenses')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create expense' })
  @ApiResponse({ status: 201, description: 'Expense created', type: Expense })
  create(
    @GetUser('id') userId: string,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    return this.expensesService.create(userId, createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'List expenses' })
  @ApiResponse({ status: 200, description: 'Expenses list' })
  findAll(@GetUser('id') userId: string, @Query() query: QueryExpenseDto) {
    return this.expensesService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  @ApiResponse({ status: 200, description: 'Expense found', type: Expense })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update expense' })
  @ApiResponse({ status: 200, description: 'Expense updated', type: Expense })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, userId, updateExpenseDto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve expense' })
  @ApiResponse({ status: 200, description: 'Expense approved', type: Expense })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  approve(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.approve(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  @ApiResponse({ status: 200, description: 'Expense deleted' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.remove(id, userId);
  }

  @Post(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reprocess an expense' })
  @ApiResponse({ status: 200, description: 'Expense reprocessing started', type: Expense })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 409, description: 'Expense already processing' })
  @ApiResponse({ status: 429, description: 'Retry limit reached' })
  reprocess(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.reprocess(id, userId);
  }

  @Sse(':id/status-stream')
  @ApiOperation({ summary: 'Stream expense status changes via SSE' })
  statusStream(@GetUser('id') userId: string, @Param('id') id: string): Observable<MessageEvent> {
    return this.expensesService.getStatusStream(id, userId);
  }
}
