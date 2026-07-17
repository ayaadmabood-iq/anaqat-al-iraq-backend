import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Book,
  DownloadLog,
  IssuedCopy,
  IssuedCopyGeneration,
  Order,
  User,
} from '@/database';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ForensicReportService } from './forensic-report.service';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Book,
      IssuedCopy,
      IssuedCopyGeneration,
      Order,
      User,
      DownloadLog,
    ]),
    FingerprintModule,
  ],
  providers: [AdminService, ForensicReportService],
  controllers: [AdminController],
})
export class AdminModule {}
