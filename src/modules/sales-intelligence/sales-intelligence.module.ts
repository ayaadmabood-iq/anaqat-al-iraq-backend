import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CustomerSession,
  OutfitRecommendation,
  OutfitRecommendationItem,
  RecommendationSignal,
  InventoryMatchScore,
  AiProcessingJob,
  ClothingItem,
  SizeStock,
  Sale,
} from '@/database';
import { AuthModule } from '@/modules/auth/auth.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { SalesIntelligenceController } from './sales-intelligence.controller';
import { CustomerSessionService } from './services/customer-session.service';
import { RecommendationEngineService } from './services/recommendation-engine.service';
import { InventoryMatchingService } from './services/inventory-matching.service';
import { OutcomeTrackingService } from './services/outcome-tracking.service';
import { AiProcessingJobService } from './services/ai-processing-job.service';
import { ReportingService } from './services/reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerSession,
      OutfitRecommendation,
      OutfitRecommendationItem,
      RecommendationSignal,
      InventoryMatchScore,
      AiProcessingJob,
      ClothingItem,
      SizeStock,
      Sale,
    ]),
    AuthModule,
    InventoryModule,
  ],
  controllers: [SalesIntelligenceController],
  providers: [
    CustomerSessionService,
    RecommendationEngineService,
    InventoryMatchingService,
    OutcomeTrackingService,
    AiProcessingJobService,
    ReportingService,
  ],
})
export class SalesIntelligenceModule {}
