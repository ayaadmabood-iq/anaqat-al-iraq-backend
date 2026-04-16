import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '@/database';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private storesRepository: Repository<Store>,
  ) {}

  async count(): Promise<number> {
    return this.storesRepository.count();
  }

  async createStore(data: {
    name: string;
    address?: string;
    phone?: string;
  }): Promise<Store> {
    const store = this.storesRepository.create(data);
    return this.storesRepository.save(store);
  }

  async getStoreById(storeId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id: storeId },
      relations: ['users', 'clothingItems'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async getAllStores(): Promise<Store[]> {
    return this.storesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateStore(
    storeId: string,
    data: Partial<{
      name: string;
      address: string;
      phone: string;
      isActive: boolean;
    }>,
  ): Promise<Store> {
    const store = await this.getStoreById(storeId);
    Object.assign(store, data);
    return this.storesRepository.save(store);
  }

  async deleteStore(storeId: string): Promise<void> {
    const store = await this.getStoreById(storeId);
    await this.storesRepository.remove(store);
  }
}
