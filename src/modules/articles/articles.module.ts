import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '@/database';
import { ArticlesService } from './articles.service';
import {
  AdminArticlesController,
  PublicArticlesController,
} from './articles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [ArticlesService],
  controllers: [PublicArticlesController, AdminArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule {}
