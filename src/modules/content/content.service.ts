import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPage, ContentPageVersion, User } from '@/database';
import { sanitizeCmsValue } from './sanitize';
import { AuditService } from '@/modules/audit/audit.service';

/**
 * IRPB file 5 §4 — CMS pages. Public reads return `publishedValue`; drafts
 * are edited separately and promoted with publish(). Every save appends to
 * `content_page_versions` (immutable) and to the audit log.
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
    @InjectRepository(ContentPage)
    private readonly pages: Repository<ContentPage>,
    @InjectRepository(ContentPageVersion)
    private readonly versions: Repository<ContentPageVersion>,
    private readonly audit: AuditService,
  ) {}

  private guardPublicKey(key: string) {
    if (!PUBLIC_KEYS.has(key)) {
      throw new NotFoundException('unknown page');
    }
  }

  private guardAdminKey(key: string) {
    if (!key || key.length > 80) throw new BadRequestException('bad key');
    if (!/^[a-z0-9._-]+$/i.test(key)) {
      throw new BadRequestException('invalid key');
    }
  }

  async getPublic(key: string) {
    this.guardPublicKey(key);
    const row = await this.pages.findOne({ where: { key } });
    if (!row || row.publishedValue === null) {
      return { key, value: null };
    }
    return {
      key,
      version: row.version,
      value: row.publishedValue,
      publishedAt: row.publishedAt,
    };
  }

  listAllForAdmin() {
    return this.pages.find({ order: { key: 'ASC' } });
  }

  async getForAdmin(key: string) {
    const row = await this.pages.findOne({ where: { key } });
    if (!row) throw new NotFoundException();
    return row;
  }

  async listVersions(key: string) {
    const row = await this.pages.findOne({ where: { key } });
    if (!row) throw new NotFoundException();
    return this.versions.find({
      where: { pageId: row.id },
      order: { version: 'DESC' },
    });
  }

  async saveDraft(actor: User, key: string, rawValue: unknown, ip?: string) {
    this.guardAdminKey(key);
    const clean = sanitizeCmsValue(rawValue);
    let row = await this.pages.findOne({ where: { key } });
    let versionNumber: number;
    if (!row) {
      row = this.pages.create({
        key,
        draftValue: clean,
        publishedValue: null,
        publishedAt: null,
        version: 1,
        updatedByUserId: actor.id,
      });
      versionNumber = 1;
    } else {
      row.draftValue = clean;
      row.updatedByUserId = actor.id;
      row.version = row.version + 1;
      versionNumber = row.version;
    }
    await this.pages.save(row);
    await this.versions.save(
      this.versions.create({
        pageId: row.id,
        version: versionNumber,
        value: clean,
        action: 'draft_saved',
        actorUserId: actor.id,
      }),
    );
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'cms.draft_saved',
      entity: 'content_page',
      entityId: row.id,
      metadata: { key, version: versionNumber },
      ipAddress: ip,
    });
    return row;
  }

  async publish(actor: User, key: string, ip?: string) {
    this.guardAdminKey(key);
    const row = await this.pages.findOne({ where: { key } });
    if (!row) throw new NotFoundException();
    if (row.draftValue === undefined || row.draftValue === null) {
      throw new BadRequestException('no draft to publish');
    }
    row.publishedValue = row.draftValue;
    row.publishedAt = new Date();
    row.version = row.version + 1;
    row.updatedByUserId = actor.id;
    await this.pages.save(row);
    await this.versions.save(
      this.versions.create({
        pageId: row.id,
        version: row.version,
        value: row.publishedValue,
        action: 'published',
        actorUserId: actor.id,
      }),
    );
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'cms.published',
      entity: 'content_page',
      entityId: row.id,
      metadata: { key, version: row.version },
      ipAddress: ip,
    });
    return row;
  }

  async remove(actor: User, key: string, ip?: string) {
    const row = await this.pages.findOne({ where: { key } });
    if (!row) throw new NotFoundException();
    await this.pages.remove(row);
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'cms.deleted',
      entity: 'content_page',
      entityId: row.id,
      metadata: { key },
      ipAddress: ip,
    });
    return { ok: true };
  }
}
