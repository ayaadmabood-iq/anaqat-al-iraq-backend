import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuedCopy } from '@/database';
import { FingerprintService } from './fingerprint.service';

@Module({
  imports: [TypeOrmModule.forFeature([IssuedCopy])],
  providers: [FingerprintService],
  exports: [FingerprintService],
})
export class FingerprintModule {}
