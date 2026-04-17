import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ClothingItem, SizeStock, InventoryMatchScore, AudienceTag } from '@/database';
import { VisionClassificationResult } from '@/modules/inventory/classification.service';

export interface CandidateItem {
  item: ClothingItem;
  score: number;
  scoreBreakdown: { color: number; category: number; recency: number };
  inStock: boolean;
  availableSize: string | null;
}

// Vision categoryPreset → keywords to match against ClothingCategory.nameEn
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  abayas: ['abaya', 'عباية'],
  abayas_embroidered: ['abaya', 'embroidered', 'مطرز'],
  dishdashes: ['dishdasha', 'dish', 'دشداشة'],
  galabiyas: ['galabiya', 'جلابية', 'kaftan'],
  dresses: ['dress', 'فستان', 'gown'],
  formal: ['formal', 'suit', 'رسمي', 'بدلة'],
  casual: ['casual', 'shirt', 'trouser', 'jeans', 'كاجوال', 'قميص', 'بنطلون'],
  accessories: ['accessor', 'bag', 'belt', 'إكسسوار', 'حقيبة', 'حزام'],
};

const NEUTRAL_COLOR_FAMILIES = new Set(['black', 'white', 'cream', 'silver', 'multi']);

function colorScore(itemFamily: string | null, signalFamily: string | null): number {
  if (!itemFamily || !signalFamily) return 0.2;
  if (itemFamily.toLowerCase() === signalFamily.toLowerCase()) return 1.0;
  if (NEUTRAL_COLOR_FAMILIES.has(itemFamily.toLowerCase()) ||
      NEUTRAL_COLOR_FAMILIES.has(signalFamily.toLowerCase())) return 0.5;
  return 0.1;
}

function categoryScore(categoryNameEn: string, categoryPreset: string | null): number {
  if (!categoryPreset) return 0.3;
  const keywords = CATEGORY_KEYWORDS[categoryPreset] ?? [categoryPreset];
  const name = categoryNameEn.toLowerCase();
  return keywords.some((k) => name.includes(k.toLowerCase())) ? 1.0 : 0.2;
}

@Injectable()
export class InventoryMatchingService {
  constructor(
    @InjectRepository(ClothingItem)
    private readonly itemRepository: Repository<ClothingItem>,
    @InjectRepository(SizeStock)
    private readonly sizeStockRepository: Repository<SizeStock>,
    @InjectRepository(InventoryMatchScore)
    private readonly matchScoreRepository: Repository<InventoryMatchScore>,
  ) {}

  async matchAndScore(
    sessionId: string,
    storeId: string,
    signal: VisionClassificationResult | null,
  ): Promise<CandidateItem[]> {
    // Load active items with sizes (eager) and category
    const items = await this.itemRepository.find({
      where: { storeId, isActive: true },
      relations: ['category'],
      order: { createdAt: 'ASC' },
    });

    // Audience filter: skip items that don't match signal audience
    const audienceFiltered = items.filter((item) => {
      if (!signal || signal.source === 'manual_fallback') return true;
      if (item.audienceTag === AudienceTag.UNISEX) return true;
      // Map Vision audience to entity enum
      const signalTag = signal.audienceTag === 'MEN' ? AudienceTag.MEN
        : signal.audienceTag === 'WOMEN' ? AudienceTag.WOMEN
        : AudienceTag.UNISEX;
      return item.audienceTag === signalTag;
    });

    // Compute recency scores (sale count per item in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const saleCounts: Array<{ clothingItemId: string; cnt: string }> =
      await this.sizeStockRepository.manager.query(
        `SELECT sl."clothingItemId", COUNT(*)::int as cnt
         FROM sale_lines sl
         JOIN sales s ON s.id = sl."saleId"
         WHERE s."storeId" = $1 AND s."createdAt" >= $2
         GROUP BY sl."clothingItemId"`,
        [storeId, thirtyDaysAgo],
      );
    const saleCountMap = new Map(saleCounts.map((r) => [r.clothingItemId, parseInt(r.cnt, 10)]));
    const maxCount = Math.max(...saleCounts.map((r) => parseInt(r.cnt, 10)), 1);

    // Score and collect candidates
    const candidates: CandidateItem[] = [];
    const scoreRows: Partial<InventoryMatchScore>[] = [];

    for (const item of audienceFiltered) {
      const inStockSizes = (item.sizes ?? []).filter((s) => s.quantity > 0);
      const inStock = inStockSizes.length > 0;
      const availableSize = inStockSizes[0]?.size ?? null;

      const color = signal ? colorScore(item.colorFamily, signal.primaryColorFamily) : 0.3;
      const category = signal
        ? categoryScore(item.category?.nameEn ?? '', signal.categoryPreset)
        : 0.3;
      const recency = (saleCountMap.get(item.id) ?? 0) / maxCount;

      const score = 0.4 * color + 0.3 * category + 0.3 * recency;
      const scoreBreakdown = { color, category, recency };

      candidates.push({ item, score, scoreBreakdown, inStock, availableSize });
      scoreRows.push({
        id: uuid(),
        sessionId,
        clothingItemId: item.id,
        score,
        scoreBreakdown,
        inStock,
      });
    }

    // Persist match scores (fire-and-forget errors; analytics only)
    this.matchScoreRepository.save(scoreRows as InventoryMatchScore[]).catch(() => {});

    // Sort by score DESC, then createdAt ASC for determinism when scores are equal
    return candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.createdAt.getTime() - b.item.createdAt.getTime();
    });
  }
}
