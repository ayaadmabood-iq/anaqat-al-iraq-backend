import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const uploadDirRaw = config.get<string>('uploadDir') as string;
  const uploadsDir = path.isAbsolute(uploadDirRaw)
    ? uploadDirRaw
    : path.join(process.cwd(), uploadDirRaw);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.enableCors({
    origin: config.get<string>('corsOrigin') as string,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const express = app.getHttpAdapter().getInstance();
  express.use('/uploads', require('express').static(uploadsDir));

  /**
   * enableImplicitConversion is deliberately OFF.
   * It converts "false" → Boolean("false") = true (any non-empty string is
   * truthy), silently breaking boolean query filters. Every primitive @Query
   * now uses an explicit pipe (DefaultValuePipe+ParseIntPipe, ParseUUIDPipe)
   * and every boolean field goes through an @Transform in its DTO.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<AppConfig['port']>('port') as number;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api/v1`);
  console.log(`Uploads served from ${uploadsDir}`);
}

bootstrap();
