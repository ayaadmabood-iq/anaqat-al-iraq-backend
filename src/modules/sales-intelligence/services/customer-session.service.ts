import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerSession } from '@/database';
import { CreateSessionDto } from '../dto/create-session.dto';
import { ListSessionsQueryDto } from '../dto/list-sessions-query.dto';

@Injectable()
export class CustomerSessionService {
  constructor(
    @InjectRepository(CustomerSession)
    private readonly sessionRepository: Repository<CustomerSession>,
  ) {}

  async create(_dto: CreateSessionDto, _userId: string): Promise<CustomerSession> {
    throw new Error('Not implemented');
  }

  async findOne(_sessionId: string): Promise<CustomerSession> {
    throw new Error('Not implemented');
  }

  async findAll(_query: ListSessionsQueryDto): Promise<{ data: CustomerSession[]; total: number }> {
    throw new Error('Not implemented');
  }

  async updateStatus(_sessionId: string, _status: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
