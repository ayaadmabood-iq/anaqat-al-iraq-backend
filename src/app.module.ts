import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@/config/configuration';
import { validationSchema } from '@/config/validation.schema';
import { buildDatabaseConfig } from '@/config/database.config';
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

const entities = [
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
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDatabaseConfig(config, entities),
    }),
    TypeOrmModule.forFeature(entities),
    AuthModule,
    UsersModule,
    StoreModule,
    InventoryModule,
    SalesModule,
  ],
})
export class AppModule {}
