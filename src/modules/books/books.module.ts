import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book, BookCategory } from '@/database';
import { BooksService } from './books.service';
import { AdminBooksController, PublicBooksController } from './books.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookCategory])],
  providers: [BooksService],
  controllers: [PublicBooksController, AdminBooksController],
  exports: [BooksService],
})
export class BooksModule {}
