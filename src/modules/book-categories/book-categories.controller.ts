import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookCategoriesService } from './book-categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/save-category.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CONTENT_ADMIN } from '@/modules/auth/roles';

@Controller('book-categories')
export class PublicBookCategoriesController {
  constructor(private readonly svc: BookCategoriesService) {}

  @Get()
  list(@Query('lang') lang = 'ar') {
    return this.svc.publicList(lang);
  }
}

@UseGuards(JwtAuthGuard)
@Roles(...CONTENT_ADMIN)
@Controller('admin/book-categories')
export class AdminBookCategoriesController {
  constructor(private readonly svc: BookCategoriesService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
