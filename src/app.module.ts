import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '@/config/database.config';
import {
  Store,
  User,
  ClothingCategory,
  ClothingItem,
  SizeStock,
  Sale,
  SaleLine,
  CustomerSession,
  OutfitRecommendation,
  OutfitRecommendationItem,
  AiProcessingJob,
  AuditLog,
} from '@/database';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { StoreModule } from '@/modules/store/store.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { SalesModule } from '@/modules/sales/sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      ...getDatabaseConfig(),
      entities: [
        Store,
        User,
        ClothingCategory,
        ClothingItem,
        SizeStock,
        Sale,
        SaleLine,
        CustomerSession,
        OutfitRecommendation,
        OutfitRecommendationItem,
        AiProcessingJob,
        AuditLog,
      ],
    }),
    AuthModule,
    UsersModule,
    StoreModule,
    InventoryModule,
    SalesModule,
  ],
})
export class AppModule {}
