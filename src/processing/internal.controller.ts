import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProcessingService } from './processing.service';
import { ProcessingResultRequestDto } from './dto/processing-result-request.dto';
import { ApiKeyGuard } from './api-key.guard';

@ApiTags('internal')
@Controller('internal')
@UseGuards(ApiKeyGuard)
export class InternalController {
  constructor(private readonly processingService: ProcessingService) {}

  @Post('processing-result')
  @ApiOperation({ summary: 'Receive processing result from AI service' })
  @ApiResponse({ status: 201, description: 'Processing result saved' })
  @ApiResponse({ status: 401, description: 'Missing X-API-Key header' })
  @ApiResponse({ status: 403, description: 'Invalid API key' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 400, description: 'Expense is not in PROCESSING status' })
  processResult(@Body() dto: ProcessingResultRequestDto) {
    return this.processingService.processResult(dto);
  }
}
