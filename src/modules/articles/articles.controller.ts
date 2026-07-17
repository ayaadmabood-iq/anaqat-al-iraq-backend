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

@Controller('articles')
export class PublicArticlesController {
  constructor(private readonly svc: ArticlesService) {}

  @Get()
  list(@Query('lang') lang = 'ar') {
    return this.svc.listPublic(lang);
  }

  @Get(':slug')
  read(@Param('slug') slug: string, @Query('lang') lang = 'ar') {
    return this.svc.getPublic(slug, lang);
  }
}

@UseGuards(JwtAuthGuard)
@Roles('admin')
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
