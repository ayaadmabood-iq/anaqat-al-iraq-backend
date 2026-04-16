import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutfitRecommendation, Sale, CustomerSession } from '@/database';

@Injectable()
export class OutcomeTrackingService {
  constructor(
    @InjectRepository(OutfitRecommendation)
    private readonly recommendationRepository: Repository<OutfitRecommendation>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(CustomerSession)
    private readonly sessionRepository: Repository<CustomerSession>,
  ) {}

  async markPresented(_sessionId: string, _rank: number): Promise<OutfitRecommendation> {
    throw new Error('Not implemented');
  }

  async convert(
    _sessionId: string,
    _rank: number,
    _saleId: string,
    _storeId: string,
  ): Promise<OutfitRecommendation> {
    throw new Error('Not implemented');
  }
}
