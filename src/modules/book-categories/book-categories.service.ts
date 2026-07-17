import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookCategory } from '@/database';
import { pickLocalized } from '@/modules/books/books.service';

export class SaveCategoryDto {
  slug: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  displayOrder?: number;
}

@Injectable()
export class BookCategoriesService {
  constructor(
    @InjectRepository(BookCategory)
    private readonly repo: Repository<BookCategory>,
  ) {}

  async publicList(lang: string) {
    const rows = await this.repo.find({
      order: { displayOrder: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: pickLocalized(r.name, lang),
      description: pickLocalized(r.description, lang),
    }));
  }

  listAll() {
    return this.repo.find({ order: { displayOrder: 'ASC' } });
  }

  async create(dto: SaveCategoryDto) {
    const dup = await this.repo.findOne({ where: { slug: dto.slug } });
    if (dup) throw new BadRequestException('slug already used');
    return this.repo.save(
      this.repo.create({
        slug: dto.slug,
        name: dto.name,
        description: dto.description ?? {},
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
  }

  async update(id: string, dto: Partial<SaveCategoryDto>) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.displayOrder !== undefined) row.displayOrder = dto.displayOrder;
    return this.repo.save(row);
  }

  async remove(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    await this.repo.remove(row);
    return { ok: true };
  }
}
