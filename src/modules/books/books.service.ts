import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '@/database';
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

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly books: Repository<Book>,
  ) {}

  async listPublic(lang: string) {
    const rows = await this.books.find({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
    });
    return rows.map((b) => this.toPublic(b, lang));
  }

  async getPublicBySlug(slug: string, lang: string) {
    const b = await this.books.findOne({ where: { slug } });
    if (!b || b.status !== 'published') throw new NotFoundException('book not found');
    return this.toPublic(b, lang);
  }

  async getById(id: string): Promise<Book> {
    const b = await this.books.findOne({ where: { id } });
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
      price: { usd: b.priceUsd, iqd: b.priceIqd },
      publishedAt: b.publishedAt,
    };
  }

  /* ─── Admin ─── */

  listAll() {
    return this.books.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateBookDto): Promise<Book> {
    const existing = await this.books.findOne({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('slug already used');
    const now = new Date();
    const b = this.books.create({
      slug: dto.slug,
      title: dto.title,
      author: dto.author,
      description: dto.description ?? {},
      masterPdfPath: dto.masterPdfPath,
      coverImagePath: dto.coverImagePath ?? null,
      pageCount: dto.pageCount ?? 0,
      priceUsd: dto.priceUsd,
      priceIqd: dto.priceIqd ?? null,
      status: dto.status ?? 'draft',
      publishedAt: dto.status === 'published' ? now : null,
    });
    return this.books.save(b);
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    const b = await this.getById(id);
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
}
