import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccount } from '@/database';
import { BankAccountsService } from './bank-accounts.service';
import {
  AdminBankAccountsController,
  BankAccountsController,
} from './bank-accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BankAccount])],
  providers: [BankAccountsService],
  controllers: [BankAccountsController, AdminBankAccountsController],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
