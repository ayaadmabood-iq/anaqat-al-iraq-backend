import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '@/database';

/**
 * Public CMS pages required by IRPB file 5 §4 (sitemap: عن المنصة، عن المؤسس،
 * الأسئلة الشائعة، تواصل معنا). Stored in the generic settings table so the
 * founder can edit from the admin panel without a redeploy.
 */
const PUBLIC_KEYS = new Set([
  'page.about',
  'page.founder',
  'page.faq',
  'page.contact',
  'page.home_hero',
  'purchase.agreement',
]);

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  private guardPublicKey(key: string) {
    if (!PUBLIC_KEYS.has(key)) {
      throw new NotFoundException('unknown page');
    }
  }

  async getPublic(key: string) {
    this.guardPublicKey(key);
    const row = await this.repo.findOne({ where: { key } });
    if (!row) return { key, value: null };
    return { key, value: row.value, updatedAt: row.updatedAt };
  }

  async listAllForAdmin() {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async put(key: string, value: unknown) {
    if (!key || key.length > 80) throw new BadRequestException('bad key');
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ key, value }));
  }

  async remove(key: string) {
    const existing = await this.repo.findOne({ where: { key } });
    if (!existing) throw new NotFoundException();
    await this.repo.remove(existing);
    return { ok: true };
  }
}
