import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { CategoryBreakdownQueryDto } from './dto/category-breakdown-query.dto';
import { TrendQueryDto } from './dto/trend-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly spending summary' })
  @ApiResponse({
    status: 200,
    description: 'Monthly summary with totals, category breakdown, top vendors, and budget comparison',
  })
  getSummary(
    @GetUser('id') userId: string,
    @Query() query: SummaryQueryDto,
  ) {
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
}
