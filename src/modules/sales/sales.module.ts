import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Sale,
  SaleLine,
  ClothingItem,
  SizeStock,
} from '@/database';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleLine, ClothingItem, SizeStock]),
    AuthModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
