import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { UploadUrlRequestDto } from './dto/upload-url.request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@Controller('expenses/:expenseId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate presigned upload URL for a file' })
  @ApiResponse({ status: 201, description: 'Upload URL generated' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  generateUploadUrl(
    @GetUser('id') userId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UploadUrlRequestDto,
  ) {
    return this.filesService.generateUploadUrl(userId, expenseId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List files for an expense' })
  @ApiResponse({ status: 200, description: 'Files list' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  findByExpense(
    @GetUser('id') userId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.filesService.findByExpense(userId, expenseId);
  }

  @Get(':fileId/download-url')
  @ApiOperation({ summary: 'Generate presigned download URL for a file' })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  @ApiResponse({ status: 404, description: 'Expense or file not found' })
  generateDownloadUrl(
    @GetUser('id') userId: string,
    @Param('expenseId') expenseId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.generateDownloadUrl(userId, expenseId, fileId);
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'Expense or file not found' })
  remove(
    @GetUser('id') userId: string,
    @Param('expenseId') expenseId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.remove(userId, expenseId, fileId);
  }
}
