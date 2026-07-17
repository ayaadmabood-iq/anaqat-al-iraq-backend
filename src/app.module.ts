import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  seconds,
} from '@nestjs/throttler';
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
     * Rate limiting per IRPB file 3 §8. Three named tiers so we can pick per
     * endpoint (unauthenticated auth = burst, general API = default, uploads
     * = strict) without inventing new numbers each time.
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: seconds(60), limit: 120 },
      { name: 'auth', ttl: seconds(60), limit: 20 },
      { name: 'upload', ttl: seconds(60), limit: 10 },
    ]),
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
