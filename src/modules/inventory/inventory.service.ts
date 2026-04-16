import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ClothingItem,
  SizeStock,
  ClothingCategory,
} from '@/database';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReduceStockDto } from './dto/reduce-stock.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(ClothingItem)
    private itemsRepository: Repository<ClothingItem>,
    @InjectRepository(SizeStock)
    private sizeStockRepository: Repository<SizeStock>,
    @InjectRepository(ClothingCategory)
    private categoriesRepository: Repository<ClothingCategory>,
  ) {}

  async createItem(
    storeId: string,
    createItemDto: CreateItemDto,
  ): Promise<ClothingItem> {
    // Verify category exists
    const category = await this.categoriesRepository.findOne({
      where: { id: createItemDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Create clothing item. The `sizes` relation has cascade:true, so saving
    // the item also inserts its size rows. Don't also call sizeStockRepository.save()
    // for the same rows — that produces duplicate-key errors on UQ_clothing_item_size.
    const { sizes: requestedSizes, ...itemFields } = createItemDto;
    const item = this.itemsRepository.create({
      ...itemFields,
      storeId,
      categoryId: createItemDto.categoryId,
    });

    const savedItem = await this.itemsRepository.save(item);

    if (requestedSizes && requestedSizes.length > 0) {
      const sizeStocks = requestedSizes.map((size) =>
        this.sizeStockRepository.create({
          clothingItemId: savedItem.id,
          ...size,
        }),
      );
      await this.sizeStockRepository.save(sizeStocks);
      savedItem.sizes = sizeStocks;
    }

    return savedItem;
  }

  async getItemById(itemId: string, storeId: string): Promise<ClothingItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, storeId },
      relations: ['category', 'sizes'],
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async getItemsByStore(
    storeId: string,
    filters?: {
      categoryId?: string;
      isActive?: boolean;
      colorFamily?: string;
    },
  ): Promise<ClothingItem[]> {
    const query = this.itemsRepository
      .createQueryBuilder('item')
      .where('item.storeId = :storeId', { storeId })
      .leftJoinAndSelect('item.sizes', 'sizes')
      .leftJoinAndSelect('item.category', 'category');

    if (filters?.categoryId) {
      query.andWhere('item.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('item.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    if (filters?.colorFamily) {
      query.andWhere('item.colorFamily = :colorFamily', {
        colorFamily: filters.colorFamily,
      });
    }

    return query.orderBy('item.createdAt', 'DESC').getMany();
  }

  async searchItems(
    storeId: string,
    searchTerm: string,
  ): Promise<ClothingItem[]> {
    return this.itemsRepository
      .createQueryBuilder('item')
      .where('item.storeId = :storeId', { storeId })
      .andWhere(
        '(item.primaryColor ILIKE :search OR item.secondaryColor ILIKE :search OR item.styleTag ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .leftJoinAndSelect('item.sizes', 'sizes')
      .leftJoinAndSelect('item.category', 'category')
      .orderBy('item.createdAt', 'DESC')
      .getMany();
  }

  async updateItem(
    itemId: string,
    storeId: string,
    updateItemDto: UpdateItemDto,
  ): Promise<ClothingItem> {
    const item = await this.getItemById(itemId, storeId);

    Object.assign(item, updateItemDto);
    return this.itemsRepository.save(item);
  }

  async deleteItem(itemId: string, storeId: string): Promise<void> {
    const item = await this.getItemById(itemId, storeId);
    await this.itemsRepository.remove(item);
  }

  async addSize(
    itemId: string,
    storeId: string,
    size: string,
    quantity: number,
  ): Promise<SizeStock> {
    const item = await this.getItemById(itemId, storeId);

    // Check if size already exists
    const existingSize = await this.sizeStockRepository.findOne({
      where: {
        clothingItemId: item.id,
        size,
      },
    });

    if (existingSize) {
      existingSize.quantity += quantity;
      return this.sizeStockRepository.save(existingSize);
    }

    const sizeStock = this.sizeStockRepository.create({
      clothingItemId: item.id,
      size,
      quantity,
    });

    return this.sizeStockRepository.save(sizeStock);
  }

  async updateStock(
    itemId: string,
    storeId: string,
    size: string,
    quantity: number,
  ): Promise<SizeStock> {
    const item = await this.getItemById(itemId, storeId);

    const sizeStock = await this.sizeStockRepository.findOne({
      where: {
        clothingItemId: item.id,
        size,
      },
    });

    if (!sizeStock) {
      throw new NotFoundException('Size not found for this item');
    }

    sizeStock.quantity = quantity;
    return this.sizeStockRepository.save(sizeStock);
  }

  async reduceStock(
    itemId: string,
    storeId: string,
    reduceStockDto: ReduceStockDto,
  ): Promise<SizeStock> {
    const item = await this.getItemById(itemId, storeId);

    const sizeStock = await this.sizeStockRepository.findOne({
      where: {
        clothingItemId: item.id,
        size: reduceStockDto.size,
      },
    });

    if (!sizeStock) {
      throw new NotFoundException('Size not found for this item');
    }

    if (sizeStock.quantity < reduceStockDto.quantity) {
      throw new BadRequestException(
        'Insufficient stock for the requested quantity',
      );
    }

    sizeStock.quantity -= reduceStockDto.quantity;
    return this.sizeStockRepository.save(sizeStock);
  }

  async removeSize(itemId: string, storeId: string, size: string): Promise<void> {
    const item = await this.getItemById(itemId, storeId);

    const sizeStock = await this.sizeStockRepository.findOne({
      where: {
        clothingItemId: item.id,
        size,
      },
    });

    if (!sizeStock) {
      throw new NotFoundException('Size not found for this item');
    }

    await this.sizeStockRepository.remove(sizeStock);
  }

  async getTotalStockByStore(storeId: string): Promise<number> {
    const result = await this.sizeStockRepository
      .createQueryBuilder('size')
      .innerJoinAndSelect(
        'size.clothingItem',
        'item',
        'item.storeId = :storeId',
        { storeId },
      )
      .select('SUM(size.quantity)', 'total')
      .getRawOne();

    return result?.total || 0;
  }

  async getCategories(): Promise<ClothingCategory[]> {
    return this.categoriesRepository.find({
      where: { isActive: true },
      order: { nameAr: 'ASC' },
    });
  }
}
