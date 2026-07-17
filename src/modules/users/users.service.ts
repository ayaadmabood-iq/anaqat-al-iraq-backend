import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/database';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  private strip(u: User) {
    const { passwordHash, ...rest } = u;
    return rest;
  }

  async listForAdmin(search?: string) {
    const qb = this.repo
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC')
      .limit(500);
    if (search) {
      qb.where('u.email ILIKE :q OR u.fullName ILIKE :q', {
        q: `%${search}%`,
      });
    }
    const rows = await qb.getMany();
    return rows.map((r) => this.strip(r));
  }

  async getForAdmin(id: string) {
    const u = await this.repo.findOne({
      where: { id },
      relations: ['orders', 'issuedCopies'],
    });
    if (!u) throw new NotFoundException();
    return this.strip(u);
  }

  async setActive(id: string, isActive: boolean) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    u.isActive = isActive;
    return this.strip(await this.repo.save(u));
  }
}
