import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuedCopy, IssuedCopyGeneration } from '@/database';
import { FingerprintService } from './fingerprint.service';
import { SigningService } from './signing.service';

@Module({
  imports: [TypeOrmModule.forFeature([IssuedCopy, IssuedCopyGeneration])],
  providers: [FingerprintService, SigningService],
  exports: [FingerprintService, SigningService],
})
export class FingerprintModule {}
