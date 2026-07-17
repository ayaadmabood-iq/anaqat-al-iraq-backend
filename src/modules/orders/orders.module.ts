import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Order,
  OrderTransferProof,
  BankAccount,
  IssuedCopy,
} from '@/database';
import { OrdersService } from './orders.service';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { BooksModule } from '@/modules/books/books.module';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderTransferProof, BankAccount, IssuedCopy]),
    BooksModule,
    FingerprintModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController, AdminOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
