import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AiProcessingJob, JobType, JobStatus } from '@/database';

@Injectable()
export class AiProcessingJobService {
  constructor(
    @InjectRepository(AiProcessingJob)
    private readonly jobRepository: Repository<AiProcessingJob>,
  ) {}

  async create(storeId: string, sessionId: string): Promise<AiProcessingJob> {
    const job = this.jobRepository.create({
      id: uuid(),
      storeId,
      jobType: JobType.RECOMMENDATION,
      status: JobStatus.PENDING,
      inputData: { sessionId },
    });
    return this.jobRepository.save(job);
  }

  async markProcessing(jobId: string): Promise<void> {
    await this.jobRepository.update(jobId, { status: JobStatus.PROCESSING });
  }

  async markCompleted(jobId: string, outputData: Record<string, any>): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: JobStatus.COMPLETED,
      outputData,
      completedAt: new Date(),
    });
  }

  async markFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: JobStatus.FAILED,
      errorMessage,
      completedAt: new Date(),
    });
  }

  async findOne(jobId: string): Promise<AiProcessingJob> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }
}
