import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
  for (const sub of ['books', 'generated', 'transfers']) {
    const dir = path.join(storageRoot, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  logger.log(`منصة القراءة القصدية — MVP API running on http://localhost:${port}/api/v1`);
  logger.log(`Storage root: ${storageRoot}`);
}

bootstrap();
