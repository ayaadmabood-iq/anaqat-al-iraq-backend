import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book, DownloadLog, IssuedCopy, Order, User } from '@/database';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Book, IssuedCopy, Order, User, DownloadLog]),
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
