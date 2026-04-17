import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateSessionDto, userId: string): Promise<CustomerSession> {
    const session = new CustomerSession();
    session.storeId = dto.storeId;
    session.userId = userId;
    session.notes = dto.notes as any;
    session.customerGender = dto.customerGender ?? null;
    session.occasionContext = dto.occasionContext ?? null;
    session.sessionStatus = 'OPEN';
    return this.sessionRepository.save(session);
  }

  async findOne(sessionId: string): Promise<CustomerSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['recommendations', 'recommendations.items', 'recommendations.items.clothingItem'],
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return session;
  }

  async findAll(query: ListSessionsQueryDto): Promise<{ data: CustomerSession[]; total: number }> {
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.recommendations', 'rec')
      .orderBy('session.createdAt', 'DESC');

    if (query.storeId) qb.andWhere('session.storeId = :storeId', { storeId: query.storeId });
    if (query.status) qb.andWhere('session.sessionStatus = :status', { status: query.status });
    if (query.staffId) qb.andWhere('session.userId = :staffId', { staffId: query.staffId });

    const [data, total] = await qb
      .skip(query.offset ?? 0)
      .take(query.limit ?? 20)
      .getManyAndCount();

    return { data, total };
  }

  async updateImageUrl(sessionId: string, imageUrl: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { customerImageUrl: imageUrl });
  }

  async updateStatus(sessionId: string, status: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { sessionStatus: status });
  }
}
