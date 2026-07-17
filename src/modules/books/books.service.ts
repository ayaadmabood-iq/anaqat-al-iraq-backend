import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book, BookCategory } from '@/database';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

export function pickLocalized(
  map: Record<string, string> | null | undefined,
  lang: string,
  fallback = 'ar',
): string {
  if (!map) return '';
  return map[lang] || map[fallback] || Object.values(map)[0] || '';
}

export interface PublicBookListQuery {
  lang: string;
  q?: string;
  category?: string;
  featured?: boolean;
}

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly books: Repository<Book>,
    @InjectRepository(BookCategory)
    private readonly categories: Repository<BookCategory>,
  ) {}

  private baseQb() {
    return this.books
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.category', 'c');
  }

  async listPublic(query: PublicBookListQuery) {
    const qb = this.baseQb().where('b.status = :status', {
      status: 'published',
    });
    if (query.featured) qb.andWhere('b.isFeatured = TRUE');
    if (query.category) {
      qb.andWhere('c.slug = :slug', { slug: query.category });
    }
    if (query.q) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(b.title::text ILIKE :term OR b.author::text ILIKE :term OR b.description::text ILIKE :term OR EXISTS (SELECT 1 FROM unnest(b.keywords) k WHERE k ILIKE :term))`,
        { term },
      );
    }
    qb.orderBy('b.isFeatured', 'DESC').addOrderBy('b.publishedAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((b) => this.toPublic(b, query.lang));
  }

  async getPublicBySlug(slug: string, lang: string) {
    const b = await this.baseQb()
      .where('b.slug = :slug', { slug })
      .getOne();
    if (!b || b.status !== 'published') throw new NotFoundException('book not found');
    return this.toPublic(b, lang);
  }

  async getById(id: string): Promise<Book> {
    const b = await this.baseQb().where('b.id = :id', { id }).getOne();
    if (!b) throw new NotFoundException('book not found');
    return b;
  }

  async requirePublishedForPurchase(id: string): Promise<Book> {
    const b = await this.getById(id);
    if (b.status !== 'published') {
      throw new BadRequestException('هذا الكتاب غير متاح للشراء حالياً');
    }
    return b;
  }

  toPublic(b: Book, lang: string) {
    return {
      id: b.id,
      slug: b.slug,
      title: pickLocalized(b.title, lang),
      author: pickLocalized(b.author, lang),
      description: pickLocalized(b.description, lang),
      coverImagePath: b.coverImagePath,
      pageCount: b.pageCount,
      keywords: b.keywords,
      isFeatured: b.isFeatured,
      hasSample: !!b.samplePdfPath,
      category: b.category && {
        id: b.category.id,
        slug: b.category.slug,
        name: pickLocalized(b.category.name, lang),
      },
      price: { usd: b.priceUsd, iqd: b.priceIqd },
      publishedAt: b.publishedAt,
    };
  }

  /* ─── Admin ─── */

  listAll() {
    return this.baseQb().orderBy('b.createdAt', 'DESC').getMany();
  }

  private async ensureCategoryOrNull(categoryId?: string | null) {
    if (!categoryId) return;
    const c = await this.categories.findOne({ where: { id: categoryId } });
    if (!c) throw new BadRequestException('unknown category');
  }

  async create(dto: CreateBookDto): Promise<Book> {
    const existing = await this.books.findOne({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('slug already used');
    await this.ensureCategoryOrNull(dto.categoryId);
    const now = new Date();
    const b = this.books.create({
      slug: dto.slug,
      title: dto.title,
      author: dto.author,
      description: dto.description ?? {},
      masterPdfPath: dto.masterPdfPath,
      editionVersion: dto.editionVersion ?? '1',
      samplePdfPath: dto.samplePdfPath ?? null,
      coverImagePath: dto.coverImagePath ?? null,
      pageCount: dto.pageCount ?? 0,
      priceUsd: dto.priceUsd,
      priceIqd: dto.priceIqd ?? null,
      keywords: dto.keywords ?? [],
      categoryId: dto.categoryId ?? null,
      isFeatured: dto.isFeatured ?? false,
      status: dto.status ?? 'draft',
      publishedAt: dto.status === 'published' ? now : null,
    });
    return this.books.save(b);
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    const b = await this.getById(id);
    if (dto.categoryId !== undefined) {
      await this.ensureCategoryOrNull(dto.categoryId);
    }
    const wasPublished = b.status === 'published';
    Object.assign(b, dto);
    if (!wasPublished && dto.status === 'published' && !b.publishedAt) {
      b.publishedAt = new Date();
    }
    return this.books.save(b);
  }

  async suspend(id: string): Promise<Book> {
    const b = await this.getById(id);
    b.status = 'suspended';
    return this.books.save(b);
  }

  async publish(id: string): Promise<Book> {
    const b = await this.getById(id);
    b.status = 'published';
    if (!b.publishedAt) b.publishedAt = new Date();
    return this.books.save(b);
  }

  async getSampleAbsPath(slug: string) {
    const b = await this.books.findOne({ where: { slug } });
    if (!b || b.status !== 'published' || !b.samplePdfPath) {
      throw new NotFoundException('لا توجد عينة مجانية لهذا الكتاب');
    }
    return { book: b, samplePath: b.samplePdfPath };
  }
}
