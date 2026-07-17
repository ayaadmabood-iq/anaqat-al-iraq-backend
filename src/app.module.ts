import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  seconds,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { getDatabaseConfig } from '@/config/database.config';
import { ALL_ENTITIES } from '@/database';
import { AuditModule } from '@/modules/audit/audit.module';
import { MailModule } from '@/modules/mail/mail.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { BooksModule } from '@/modules/books/books.module';
import { BookCategoriesModule } from '@/modules/book-categories/book-categories.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { BankAccountsModule } from '@/modules/bank-accounts/bank-accounts.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';
import { DownloadsModule } from '@/modules/downloads/downloads.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { ContentModule } from '@/modules/content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRoot({ ...getDatabaseConfig(), entities: ALL_ENTITIES }),
    /**
     * Three named tiers per IRPB file 3 §8. See docs/RATE-LIMITS.md for exact
     * numbers. When REDIS_URL is set the counters live in Redis so multi-node
     * deploys share them; otherwise the default in-memory store is used and
     * we log a warning.
     */
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const throttlers = [
          { name: 'default', ttl: seconds(60), limit: 120 },
          { name: 'auth', ttl: seconds(60), limit: 20 },
          { name: 'upload', ttl: seconds(60), limit: 10 },
        ];
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const redis = new Redis(redisUrl, {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 2,
          });
          return {
            throttlers,
            storage: new ThrottlerStorageRedisService(redis),
          };
        }
        // eslint-disable-next-line no-console
        console.warn(
          '[throttler] REDIS_URL not set — using in-memory storage. NOT suitable for multi-node deployments.',
        );
        return { throttlers };
      },
    }),
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    BooksModule,
    BookCategoriesModule,
    ArticlesModule,
    BankAccountsModule,
    OrdersModule,
    FingerprintModule,
    DownloadsModule,
    AdminModule,
    ContentModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
