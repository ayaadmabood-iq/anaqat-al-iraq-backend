import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '@/database';
import { BooksService } from './books.service';
import { AdminBooksController, PublicBooksController } from './books.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Book])],
  providers: [BooksService],
  controllers: [PublicBooksController, AdminBooksController],
  exports: [BooksService],
})
export class BooksModule {}
