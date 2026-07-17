import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DownloadLog, DownloadToken, IssuedCopy, Order } from '@/database';
import { DownloadsService } from './downloads.service';
import { DownloadLinkService } from './download-link.service';
import {
  AdminDownloadsController,
  DownloadsController,
} from './downloads.controller';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IssuedCopy, Order, DownloadLog, DownloadToken]),
    FingerprintModule,
  ],
  providers: [DownloadsService, DownloadLinkService],
  controllers: [DownloadsController, AdminDownloadsController],
  exports: [DownloadsService],
})
export class DownloadsModule {}
