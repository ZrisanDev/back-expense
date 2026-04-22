import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { type Response } from 'express';
import { ReportsService } from './reports.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { CategoryBreakdownQueryDto } from './dto/category-breakdown-query.dto';
import { TrendQueryDto } from './dto/trend-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Stats')
@ApiBearerAuth('JWT-auth')
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly spending summary' })
  @ApiResponse({
    status: 200,
    description:
      'Monthly summary with totals, category breakdown, top vendors, and budget comparison',
  })
  getSummary(@GetUser('id') userId: string, @Query() query: SummaryQueryDto) {
    return this.reportsService.getSummary(userId, query);
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Get detailed per-category spending breakdown' })
  @ApiResponse({
    status: 200,
    description: 'Per-category spending with budget utilization',
  })
  getCategoryBreakdown(
    @GetUser('id') userId: string,
    @Query() query: CategoryBreakdownQueryDto,
  ) {
    return this.reportsService.getCategoryBreakdown(userId, query);
  }

  @Get('trend')
  @ApiOperation({ summary: 'Get monthly spending trend' })
  @ApiResponse({
    status: 200,
    description: 'Monthly spending trend with month-over-month changes',
  })
  getMonthlyTrend(
    @GetUser('id') userId: string,
    @Query() query: TrendQueryDto,
  ) {
    return this.reportsService.getMonthlyTrend(userId, query);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export expenses as CSV for a given month/year' })
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'CSV file with expenses for the specified period',
  })
  async exportCsv(
    @GetUser('id') userId: string,
    @Query() query: SummaryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.reportsService.exportCsv(userId, query);
    const month = query.month ?? new Date().getMonth() + 1;
    const year = query.year ?? new Date().getFullYear();

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-${year}-${String(month).padStart(2, '0')}.csv"`,
    });

    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
