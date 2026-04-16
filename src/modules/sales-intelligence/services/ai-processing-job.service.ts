import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProcessingJob, JobType, JobStatus } from '@/database';

@Injectable()
export class AiProcessingJobService {
  constructor(
    @InjectRepository(AiProcessingJob)
    private readonly jobRepository: Repository<AiProcessingJob>,
  ) {}

  async create(_storeId: string, _sessionId: string): Promise<AiProcessingJob> {
    throw new Error('Not implemented');
  }

  async markProcessing(_jobId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async markCompleted(_jobId: string, _outputData: Record<string, any>): Promise<void> {
    throw new Error('Not implemented');
  }

  async markFailed(_jobId: string, _errorMessage: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async findOne(_jobId: string): Promise<AiProcessingJob> {
    throw new Error('Not implemented');
  }
}
