import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@Controller('books')
export class PublicBooksController {
  constructor(private readonly svc: BooksService) {}

  @Get()
  list(@Query('lang') lang: string = 'ar') {
    return this.svc.listPublic(lang);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string, @Query('lang') lang: string = 'ar') {
    return this.svc.getPublicBySlug(slug, lang);
  }
}

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly svc: BooksService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Post()
  create(@Body() dto: CreateBookDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.svc.publish(id);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.svc.suspend(id);
  }
}
