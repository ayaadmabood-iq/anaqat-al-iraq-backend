import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccount } from '@/database';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/save-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount) private readonly repo: Repository<BankAccount>,
  ) {}

  listActive() {
    return this.repo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', bankName: 'ASC' },
    });
  }

  listAll() {
    return this.repo.find({ order: { displayOrder: 'ASC', bankName: 'ASC' } });
  }

  async findOrFail(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  create(dto: CreateBankAccountDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    const row = await this.findOrFail(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(id: string) {
    const row = await this.findOrFail(id);
    await this.repo.remove(row);
    return { ok: true };
  }
}
