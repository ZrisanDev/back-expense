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
  Req,
  HttpCode,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(201)
  create(@Req() req: any, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(req.user.id, createCategoryDto);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: QueryCategoryDto) {
    return this.categoriesService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, req.user.id, updateCategoryDto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.remove(id, req.user.id);
  }
}
