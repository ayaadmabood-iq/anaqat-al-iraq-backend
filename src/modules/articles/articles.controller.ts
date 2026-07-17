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
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/save-article.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CONTENT_ADMIN } from '@/modules/auth/roles';

@Controller('articles')
export class PublicArticlesController {
  constructor(private readonly svc: ArticlesService) {}

  @Get()
  list(
    @Query('lang') lang = 'ar',
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    return this.svc.listPublic({ lang, q, category, tag });
  }

  @Get(':slug')
  read(@Param('slug') slug: string, @Query('lang') lang = 'ar') {
    return this.svc.getPublic(slug, lang);
  }
}

@UseGuards(JwtAuthGuard)
@Roles(...CONTENT_ADMIN)
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly svc: ArticlesService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Post()
  create(@Body() dto: CreateArticleDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
