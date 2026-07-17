import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '@/config/database.config';
import { ALL_ENTITIES } from '@/database';
import { AuditModule } from '@/modules/audit/audit.module';
import { MailModule } from '@/modules/mail/mail.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { BooksModule } from '@/modules/books/books.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { BankAccountsModule } from '@/modules/bank-accounts/bank-accounts.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { FingerprintModule } from '@/modules/fingerprint/fingerprint.module';
import { DownloadsModule } from '@/modules/downloads/downloads.module';
import { AdminModule } from '@/modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRoot({ ...getDatabaseConfig(), entities: ALL_ENTITIES }),
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    BooksModule,
    ArticlesModule,
    BankAccountsModule,
    OrdersModule,
    FingerprintModule,
    DownloadsModule,
    AdminModule,
  ],
})
export class AppModule {}
