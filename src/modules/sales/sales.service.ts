import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Sale,
  SaleLine,
  ClothingItem,
  SizeStock,
} from '@/database';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(SaleLine)
    private saleLineRepository: Repository<SaleLine>,
    @InjectRepository(ClothingItem)
    private itemsRepository: Repository<ClothingItem>,
    @InjectRepository(SizeStock)
    private sizeStockRepository: Repository<SizeStock>,
  ) {}

  async createSale(storeId: string, createSaleDto: CreateSaleDto): Promise<Sale> {
    // STUB: In real implementation, validate user exists in store
    // const user = await this.usersRepository.findOne({
    //   where: { id: createSaleDto.userId, storeId }
    // });

    // Create sale
    const sale = this.salesRepository.create({
      storeId,
      userId: createSaleDto.userId,
      notes: createSaleDto.notes,
      totalAmount: 0,
    });

    const savedSale = await this.salesRepository.save(sale);

    let totalAmount = 0;

    // Process sale lines and reduce stock
    for (const lineData of createSaleDto.lines) {
      const item = await this.itemsRepository.findOne({
        where: { id: lineData.clothingItemId, storeId },
      });

      if (!item) {
        throw new NotFoundException(
          `Item ${lineData.clothingItemId} not found`,
        );
      }

      // Verify and reduce stock
      const sizeStock = await this.sizeStockRepository.findOne({
        where: {
          clothingItemId: item.id,
          size: lineData.size,
        },
      });

      if (!sizeStock) {
        throw new NotFoundException(
          `Size ${lineData.size} not found for item ${lineData.clothingItemId}`,
        );
      }

      if (sizeStock.quantity < lineData.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${item.id} in size ${lineData.size}`,
        );
      }

      // Reduce stock
      sizeStock.quantity -= lineData.quantity;
      await this.sizeStockRepository.save(sizeStock);

      // Create sale line
      const unitPrice = lineData.unitPrice || item.price || 0;
      const lineTotal = unitPrice * lineData.quantity;

      const saleLine = this.saleLineRepository.create({
        saleId: savedSale.id,
        clothingItemId: item.id,
        size: lineData.size,
        quantity: lineData.quantity,
        unitPrice,
      });

      await this.saleLineRepository.save(saleLine);

      totalAmount += lineTotal;
    }

    // Update sale total
    savedSale.totalAmount = totalAmount;
    await this.salesRepository.save(savedSale);

    // Reload with relations
    return this.getSaleById(savedSale.id, storeId);
  }

  async getSaleById(saleId: string, storeId: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id: saleId, storeId },
      relations: ['lines', 'lines.clothingItem', 'user'],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async getSalesByStore(storeId: string, limit: number = 50, offset: number = 0): Promise<{
    sales: Sale[];
    total: number;
  }> {
    const [sales, total] = await this.salesRepository.findAndCount({
      where: { storeId },
      relations: ['lines', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { sales, total };
  }

  async getSalesByUser(
    storeId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    sales: Sale[];
    total: number;
  }> {
    const [sales, total] = await this.salesRepository.findAndCount({
      where: { storeId, userId },
      relations: ['lines'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { sales, total };
  }

  async getSalesReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalSales: number;
    totalAmount: number;
    averageAmount: number;
    itemsSold: number;
  }> {
    let query = this.salesRepository
      .createQueryBuilder('sale')
      .where('sale.storeId = :storeId', { storeId })
      .leftJoinAndSelect('sale.lines', 'line');

    if (startDate) {
      query = query.andWhere('sale.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query = query.andWhere('sale.createdAt <= :endDate', { endDate });
    }

    const sales = await query.getMany();

    let totalAmount = 0;
    let itemsSold = 0;

    sales.forEach((sale) => {
      totalAmount += sale.totalAmount || 0;
      sale.lines.forEach((line) => {
        itemsSold += line.quantity;
      });
    });

    return {
      totalSales: sales.length,
      totalAmount,
      averageAmount: sales.length > 0 ? totalAmount / sales.length : 0,
      itemsSold,
    };
  }
}
