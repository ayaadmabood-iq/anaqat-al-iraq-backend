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

export interface PublicArticleQuery {
  lang: string;
  q?: string;
  category?: string;
  tag?: string;
}

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
      category: a.category,
      tags: a.tags,
      meta: includeBody
        ? {
            title: pickLocalized(a.metaTitle, lang),
            description: pickLocalized(a.metaDescription, lang),
          }
        : undefined,
      publishedAt: a.publishedAt,
    };
  }

  async listPublic(query: PublicArticleQuery) {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.status = :s', { s: 'published' });
    if (query.category) qb.andWhere('a.category = :cat', { cat: query.category });
    if (query.tag) qb.andWhere(':tag = ANY(a.tags)', { tag: query.tag });
    if (query.q) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(a.title::text ILIKE :term OR a.excerpt::text ILIKE :term OR a.body::text ILIKE :term)`,
        { term },
      );
    }
    qb.orderBy('a.publishedAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((a) => this.toPublic(a, query.lang, false));
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
      category: dto.category ?? null,
      tags: dto.tags ?? [],
      metaTitle: dto.metaTitle ?? {},
      metaDescription: dto.metaDescription ?? {},
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
