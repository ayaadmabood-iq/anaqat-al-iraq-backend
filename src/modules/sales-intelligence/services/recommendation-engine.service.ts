import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutfitRecommendation, OutfitRecommendationItem, RecommendationSignal } from '@/database';
import { ClassificationService } from '@/modules/inventory/classification.service';
import { InventoryMatchingService } from './inventory-matching.service';
import { AiProcessingJobService } from './ai-processing-job.service';

export interface RecommendResult {
  jobId: string;
  fallback: boolean;
  fallbackReason?: string;
  signal: Record<string, any> | null;
  recommendations: OutfitRecommendation[];
}

@Injectable()
export class RecommendationEngineService {
  constructor(
    @InjectRepository(OutfitRecommendation)
    private readonly recommendationRepository: Repository<OutfitRecommendation>,
    @InjectRepository(OutfitRecommendationItem)
    private readonly recommendationItemRepository: Repository<OutfitRecommendationItem>,
    @InjectRepository(RecommendationSignal)
    private readonly signalRepository: Repository<RecommendationSignal>,
    private readonly classificationService: ClassificationService,
    private readonly inventoryMatchingService: InventoryMatchingService,
    private readonly aiJobService: AiProcessingJobService,
  ) {}

  async run(
    _sessionId: string,
    _storeId: string,
    _imagePath: string,
    _occasionContext: string | null,
  ): Promise<RecommendResult> {
    throw new Error('Not implemented');
  }
}
