import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { enforceProductionGuards } from './config/production-guard';

async function bootstrap() {
  dotenv.config();
  enforceProductionGuards();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
  for (const sub of ['books', 'generated', 'transfers', 'keys']) {
    const dir = path.join(storageRoot, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  }

  // Security headers — IRPB file 3 §8. The frontend is served separately by
  // Nginx; here we set the API-side CSP that matters (no browser will actually
  // render this content, but the header still blocks a curious admin who
  // opens a JSON response directly).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

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
