import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import {
  OutfitRecommendation,
  OutfitRecommendationItem,
  RecommendationSignal,
  CustomerSession,
} from '@/database';
import { ClassificationService, VisionClassificationResult } from '@/modules/inventory/classification.service';
import { InventoryMatchingService, CandidateItem } from './inventory-matching.service';
import { AiProcessingJobService } from './ai-processing-job.service';

export interface RecommendResult {
  jobId: string;
  fallback: boolean;
  fallbackReason?: string;
  signal: RecommendationSignal | null;
  recommendations: OutfitRecommendation[];
  emptyReason?: string;
}

// ── Reason text helpers ───────────────────────────────────────────────────────

const COLOR_NAMES_AR: Record<string, string> = {
  black: 'الأسود', white: 'الأبيض', navy: 'الكحلي', blue: 'الأزرق',
  red: 'الأحمر', green: 'الأخضر', brown: 'البني', gold: 'الذهبي',
  silver: 'الفضي', cream: 'الكريمي', burgundy: 'العنابي', multi: 'المتعدد',
};
const OCCASION_NAMES_AR: Record<string, string> = {
  wedding: 'الأعراس', formal: 'المناسبات الرسمية', casual: 'الخروجات اليومية',
  party: 'الحفلات', work: 'العمل', travel: 'السفر',
};
const OUTFIT_LABELS_AR = ['الطقم الأول', 'الطقم الثاني', 'الطقم الثالث', 'الطقم الرابع'];

function buildReasonText(
  colorFamily: string | null,
  occasionContext: string | null,
  rank: number,
  fallback: boolean,
): { reasonAr: string; reasonEn: string } {
  if (fallback) {
    return {
      reasonAr: 'اقتراح من أكثر المنتجات مبيعًا في المتجر',
      reasonEn: 'A top pick from the store\'s best-selling inventory',
    };
  }
  const colorAr = colorFamily ? (COLOR_NAMES_AR[colorFamily] ?? colorFamily) : null;
  const occasionAr = occasionContext ? (OCCASION_NAMES_AR[occasionContext] ?? occasionContext) : null;

  const reasonAr = colorAr && occasionAr
    ? `يناسب ${colorAr} ومثالي لـ${occasionAr}`
    : colorAr
    ? `يناسب ${colorAr} ومناسب للمناسبات المختلفة`
    : occasionAr
    ? `مثالي لـ${occasionAr}`
    : 'من أفضل الخيارات المتوفرة في المتجر';

  const reasonEn = colorFamily && occasionContext
    ? `Suits your ${colorFamily} palette, ideal for ${occasionContext}`
    : colorFamily
    ? `Suits your ${colorFamily} palette`
    : occasionContext
    ? `Ideal for ${occasionContext}`
    : 'A top pick from available inventory';

  return { reasonAr, reasonEn };
}

// ── Outfit assembly ───────────────────────────────────────────────────────────

interface AssembledOutfit {
  primary: CandidateItem;
  accent: CandidateItem | null;
}

function assembleOutfits(candidates: CandidateItem[]): AssembledOutfit[] {
  const inStock = candidates.filter((c) => c.inStock);
  const used = new Set<string>();
  const outfits: AssembledOutfit[] = [];

  for (let rank = 0; rank < 4; rank++) {
    const primary = inStock.find((c) => !used.has(c.item.id));
    if (!primary) break;
    used.add(primary.item.id);

    // Accent: first unused item from a different category
    const accent =
      inStock.find(
        (c) => !used.has(c.item.id) && c.item.categoryId !== primary.item.categoryId,
      ) ?? inStock.find((c) => !used.has(c.item.id)) ?? null;

    if (accent) used.add(accent.item.id);
    outfits.push({ primary, accent });
  }

  return outfits;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationEngineService {
  constructor(
    @InjectRepository(OutfitRecommendation)
    private readonly recommendationRepository: Repository<OutfitRecommendation>,
    @InjectRepository(OutfitRecommendationItem)
    private readonly recommendationItemRepository: Repository<OutfitRecommendationItem>,
    @InjectRepository(RecommendationSignal)
    private readonly signalRepository: Repository<RecommendationSignal>,
    @InjectRepository(CustomerSession)
    private readonly sessionRepository: Repository<CustomerSession>,
    private readonly classificationService: ClassificationService,
    private readonly inventoryMatchingService: InventoryMatchingService,
    private readonly aiJobService: AiProcessingJobService,
  ) {}

  async run(
    sessionId: string,
    storeId: string,
    imagePath: string,
    occasionContext: string | null,
  ): Promise<RecommendResult> {
    const job = await this.aiJobService.create(storeId, sessionId);

    try {
      await this.aiJobService.markProcessing(job.id);
      await this.sessionRepository.update(sessionId, { customerImageUrl: imagePath });

      // ── Classification ────────────────────────────────────────────────────
      let visionResult: VisionClassificationResult;
      let fallback = false;
      let fallbackReason: string | undefined;

      try {
        const imageBuffer = await fs.promises.readFile(imagePath);
        visionResult = await this.classificationService.classify(imageBuffer);
        if (visionResult.source === 'manual_fallback') {
          fallback = true;
          fallbackReason = 'vision_api_unavailable';
        }
      } catch {
        visionResult = this.buildFallbackVisionResult();
        fallback = true;
        fallbackReason = 'vision_api_error';
      }

      // ── Persist signal ────────────────────────────────────────────────────
      const savedSignal = await this.signalRepository.save(
        this.signalRepository.create({
          id: uuid(),
          sessionId,
          source: visionResult.source,
          primaryColor: visionResult.primaryColorFamily,
          primaryHex: visionResult.primaryColorHex,
          secondaryColor: visionResult.secondaryColorFamily ?? null,
          audienceTag: visionResult.audienceTag,
          categoryHints: visionResult.categoryPreset ? [visionResult.categoryPreset] : null,
          rawLabels: visionResult.rawLabels as any,
        }),
      );

      // ── Inventory matching ────────────────────────────────────────────────
      const candidates = await this.inventoryMatchingService.matchAndScore(
        sessionId,
        storeId,
        fallback ? null : visionResult,
      );

      // ── Assemble outfits ──────────────────────────────────────────────────
      const outfits = assembleOutfits(candidates);

      if (outfits.length === 0) {
        await this.aiJobService.markCompleted(job.id, { recommendationCount: 0, fallback });
        await this.sessionRepository.update(sessionId, { sessionStatus: 'RECOMMENDATION_READY' });
        return {
          jobId: job.id,
          fallback,
          fallbackReason,
          signal: savedSignal,
          recommendations: [],
          emptyReason: 'no_active_stock',
        };
      }

      // ── Persist recommendations ───────────────────────────────────────────
      // IMPORTANT: do NOT save via session cascade (cascade: true on session.recommendations).
      // Save OutfitRecommendation rows directly, then save items directly.
      // This avoids the double-insert bug.
      const recommendations: OutfitRecommendation[] = [];

      for (let i = 0; i < outfits.length; i++) {
        const { primary, accent } = outfits[i];
        const rank = i + 1;
        const { reasonAr, reasonEn } = buildReasonText(
          visionResult.primaryColorFamily,
          occasionContext,
          rank,
          fallback,
        );

        const totalPrice = Math.round(
          (Number(primary.item.price ?? 0) + Number(accent?.item.price ?? 0)) * 100,
        ) / 100;

        // Save recommendation WITHOUT items attached (to avoid cascade-insert)
        const rec = await this.recommendationRepository.save(
          this.recommendationRepository.create({
            id: uuid(),
            customerSessionId: sessionId,
            rank,
            reasonAr,
            reasonEn,
            outfitLabel: OUTFIT_LABELS_AR[i] ?? `Outfit ${rank}`,
            totalPriceIqd: totalPrice > 0 ? Math.round(totalPrice) : null,
            wasPresented: false,
            convertedAt: null,
            convertedSaleId: null,
          }),
        );

        // Save items directly (bypass recommendation.items cascade)
        const itemsToSave: OutfitRecommendationItem[] = [
          this.recommendationItemRepository.create({
            id: uuid(),
            recommendationId: rec.id,
            clothingItemId: primary.item.id,
            role: 'PRIMARY',
            sizeSelected: primary.availableSize,
            unitPriceIqd: primary.item.price ? Math.round(Number(primary.item.price)) : null,
          }),
        ];

        if (accent) {
          itemsToSave.push(
            this.recommendationItemRepository.create({
              id: uuid(),
              recommendationId: rec.id,
              clothingItemId: accent.item.id,
              role: 'ACCENT',
              sizeSelected: accent.availableSize,
              unitPriceIqd: accent.item.price ? Math.round(Number(accent.item.price)) : null,
            }),
          );
        }

        await this.recommendationItemRepository.save(itemsToSave);

        // Attach items to the in-memory object (not via save)
        rec.items = itemsToSave;
        recommendations.push(rec);
      }

      // ── Finalize ──────────────────────────────────────────────────────────
      await this.sessionRepository.update(sessionId, { sessionStatus: 'RECOMMENDATION_READY' });
      await this.aiJobService.markCompleted(job.id, {
        recommendationCount: recommendations.length,
        fallback,
      });

      return { jobId: job.id, fallback, fallbackReason, signal: savedSignal, recommendations };
    } catch (err) {
      // Always resolve the job — never leave it stuck in PROCESSING
      await this.aiJobService.markFailed(job.id, (err as Error)?.message ?? 'Unknown error').catch(() => {});
      throw err;
    }
  }

  private buildFallbackVisionResult(): VisionClassificationResult {
    return {
      categoryPreset: null,
      categoryConfidence: null,
      primaryColorFamily: 'multi',
      primaryColorHex: '#808080',
      primaryColorScore: 0,
      secondaryColorFamily: null,
      secondaryColorHex: null,
      secondaryColorScore: null,
      audienceTag: 'UNISEX',
      audienceConfidence: 0,
      skinToneGroup: null,
      rawLabels: [],
      source: 'manual_fallback',
    };
  }
}
