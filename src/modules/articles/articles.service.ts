import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/database';
import { pickLocalized } from '@/modules/books/books.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/save-article.dto';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly repo: Repository<Article>,
  ) {}

  private toPublic(a: Article, lang: string, includeBody: boolean) {
    return {
      id: a.id,
      slug: a.slug,
      title: pickLocalized(a.title, lang),
      excerpt: pickLocalized(a.excerpt, lang),
      body: includeBody ? pickLocalized(a.body, lang) : undefined,
      authorDisplay: a.authorDisplay,
      publishedAt: a.publishedAt,
    };
  }

  async listPublic(lang: string) {
    const rows = await this.repo.find({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
    });
    return rows.map((a) => this.toPublic(a, lang, false));
  }

  async getPublic(slug: string, lang: string) {
    const a = await this.repo.findOne({ where: { slug } });
    if (!a || a.status !== 'published') throw new NotFoundException();
    return this.toPublic(a, lang, true);
  }

  listAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateArticleDto) {
    const exists = await this.repo.findOne({ where: { slug: dto.slug } });
    if (exists) throw new BadRequestException('slug already used');
    const a = this.repo.create({
      slug: dto.slug,
      title: dto.title,
      excerpt: dto.excerpt ?? {},
      body: dto.body,
      authorDisplay: dto.authorDisplay ?? null,
      status: dto.status ?? 'draft',
      publishedAt: dto.status === 'published' ? new Date() : null,
    });
    return this.repo.save(a);
  }

  async update(id: string, dto: UpdateArticleDto) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    const wasPublished = a.status === 'published';
    Object.assign(a, dto);
    if (!wasPublished && dto.status === 'published' && !a.publishedAt) {
      a.publishedAt = new Date();
    }
    return this.repo.save(a);
  }

  async remove(id: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    await this.repo.remove(a);
    return { ok: true };
  }
}
