import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPage, ContentPageVersion } from '@/database';
import { ContentService } from './content.service';
import {
  AdminContentController,
  PublicContentController,
} from './content.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPage, ContentPageVersion])],
  providers: [ContentService],
  controllers: [PublicContentController, AdminContentController],
  exports: [ContentService],
})
export class ContentModule {}
