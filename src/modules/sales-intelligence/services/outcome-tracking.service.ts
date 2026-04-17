import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutfitRecommendation, OutfitRecommendationItem, Sale, CustomerSession, SizeStock } from '@/database';

@Injectable()
export class OutcomeTrackingService {
  constructor(
    @InjectRepository(OutfitRecommendation)
    private readonly recommendationRepository: Repository<OutfitRecommendation>,
    @InjectRepository(OutfitRecommendationItem)
    private readonly recommendationItemRepository: Repository<OutfitRecommendationItem>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(CustomerSession)
    private readonly sessionRepository: Repository<CustomerSession>,
    @InjectRepository(SizeStock)
    private readonly sizeStockRepository: Repository<SizeStock>,
  ) {}

  async markPresented(sessionId: string, rank: number): Promise<OutfitRecommendation> {
    const rec = await this.findRecommendation(sessionId, rank);
    await this.recommendationRepository.update(rec.id, { wasPresented: true });
    rec.wasPresented = true;
    return rec;
  }

  async convert(
    sessionId: string,
    rank: number,
    saleId: string,
    storeId: string,
  ): Promise<OutfitRecommendation> {
    const rec = await this.findRecommendation(sessionId, rank);

    // Idempotency: already converted with same saleId → return current state
    if (rec.convertedSaleId === saleId) {
      return rec;
    }

    // Already converted with a different sale → conflict
    if (rec.convertedSaleId != null) {
      throw new ConflictException(
        `Recommendation rank ${rank} is already converted to sale ${rec.convertedSaleId}`,
      );
    }

    // Verify sale exists and belongs to the same store
    const sale = await this.saleRepository.findOne({ where: { id: saleId } });
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    if ((sale as any).storeId !== storeId) {
      throw new ConflictException('Sale does not belong to the same store as this session');
    }

    // Stock re-check: verify every item in the recommendation still has stock
    const items = await this.recommendationItemRepository.find({
      where: { recommendationId: rec.id },
    });

    const outOfStockItems: string[] = [];
    for (const item of items) {
      const inStock = await this.sizeStockRepository.findOne({
        where: {
          clothingItemId: item.clothingItemId,
          ...(item.sizeSelected ? { size: item.sizeSelected } : {}),
        },
      });
      if (!inStock || inStock.quantity <= 0) {
        outOfStockItems.push(item.clothingItemId);
      }
    }

    if (outOfStockItems.length > 0) {
      throw new ConflictException({ message: 'Some recommended items are out of stock', outOfStockItems });
    }

    // Commit conversion
    const now = new Date();
    await this.recommendationRepository.update(rec.id, {
      convertedSaleId: saleId,
      convertedAt: now,
    });
    await this.sessionRepository.update(sessionId, { sessionStatus: 'CONVERTED' });

    rec.convertedSaleId = saleId;
    rec.convertedAt = now;
    return rec;
  }

  private async findRecommendation(sessionId: string, rank: number): Promise<OutfitRecommendation> {
    const rec = await this.recommendationRepository.findOne({
      where: { customerSessionId: sessionId, rank },
    });
    if (!rec) {
      throw new NotFoundException(`Recommendation rank ${rank} not found for session ${sessionId}`);
    }
    return rec;
  }
}
