import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DownloadLog, IssuedCopy, Order } from '@/database';
import { DownloadsService } from './downloads.service';
import {
  AdminDownloadsController,
  DownloadsController,
} from './downloads.controller';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IssuedCopy, Order, DownloadLog]),
    FingerprintModule,
  ],
  providers: [DownloadsService],
  controllers: [DownloadsController, AdminDownloadsController],
  exports: [DownloadsService],
})
export class DownloadsModule {}
