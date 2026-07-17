import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CONTENT_ADMIN } from '@/modules/auth/roles';
import { safeFilename, safeJoin } from '@/modules/common/safe-path';

function booksSourceDir() {
  return (
    process.env.BOOKS_SOURCE_DIR ||
    path.join(process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage'), 'books')
  );
}

@Controller('books')
export class PublicBooksController {
  constructor(private readonly svc: BooksService) {}

  @Get()
  list(
    @Query('lang') lang: string = 'ar',
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('featured') featured?: string,
  ) {
    return this.svc.listPublic({
      lang,
      q,
      category,
      featured: featured === 'true' || featured === '1',
    });
  }

  @Get(':slug')
  detail(@Param('slug') slug: string, @Query('lang') lang: string = 'ar') {
    return this.svc.getPublicBySlug(slug, lang);
  }

  /**
   * IRPB file 5 §6 — "مقدمة مجانية". Publicly downloadable sample PDF, no
   * authentication needed. Nothing sensitive is inside; the master PDF stays
   * gated behind an approved order.
   */
  @Get(':slug/sample')
  async sample(@Param('slug') slug: string, @Res() res: Response) {
    const { book, samplePath } = await this.svc.getSampleAbsPath(slug);
    const abs = safeJoin(booksSourceDir(), samplePath);
    if (!fs.existsSync(abs)) throw new NotFoundException();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFilename(`${book.slug}-sample.pdf`)}"`,
    );
    fs.createReadStream(abs).pipe(res);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CONTENT_ADMIN)
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
