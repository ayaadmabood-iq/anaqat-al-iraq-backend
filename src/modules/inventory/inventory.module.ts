import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClothingItem,
  SizeStock,
  ClothingCategory,
} from '@/database';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ClassificationService } from './classification.service';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClothingItem, SizeStock, ClothingCategory]),
    AuthModule,
  ],
  providers: [InventoryService, ClassificationService],
  controllers: [InventoryController],
  exports: [InventoryService, ClassificationService],
})
export class InventoryModule {}
