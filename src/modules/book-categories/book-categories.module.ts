import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookCategory } from '@/database';
import { BookCategoriesService } from './book-categories.service';
import {
  AdminBookCategoriesController,
  PublicBookCategoriesController,
} from './book-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BookCategory])],
  providers: [BookCategoriesService],
  controllers: [
    PublicBookCategoriesController,
    AdminBookCategoriesController,
  ],
  exports: [BookCategoriesService],
})
export class BookCategoriesModule {}
