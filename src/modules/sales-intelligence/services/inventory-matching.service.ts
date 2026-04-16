import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClothingItem, SizeStock, InventoryMatchScore } from '@/database';
import { VisionClassificationResult } from '@/modules/inventory/classification.service';

export interface CandidateItem {
  item: ClothingItem;
  score: number;
  scoreBreakdown: { color: number; category: number; recency: number };
  inStock: boolean;
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
    _sessionId: string,
    _storeId: string,
    _signal: VisionClassificationResult | null,
  ): Promise<CandidateItem[]> {
    throw new Error('Not implemented');
  }
}
