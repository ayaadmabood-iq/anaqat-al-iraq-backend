import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const nodeEnv = config.get<AppConfig['nodeEnv']>('nodeEnv') as string;
  const bodyLimit = config.get<AppConfig['bodyLimit']>('bodyLimit') as string;
  const corsOrigins = config.get<AppConfig['corsOrigins']>(
    'corsOrigins',
  ) as string[];

  // Security middleware
  app.use(helmet());
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  // Uploads directory
  const uploadDirRaw = config.get<string>('uploadDir') as string;
  const uploadsDir = path.isAbsolute(uploadDirRaw)
    ? uploadDirRaw
    : path.join(process.cwd(), uploadDirRaw);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  /**
   * CORS policy:
   *  - production: explicit allow-list (validationSchema already blocked '*')
   *  - dev / test: permissive '*', no credentials
   * Never combine origin:'*' with credentials:true — browsers reject it, and
   * it would expose session cookies to arbitrary origins.
   */
  const isWildcard = corsOrigins.length === 1 && corsOrigins[0] === '*';
  app.enableCors({
    origin: isWildcard ? true : corsOrigins,
    credentials: !isWildcard,
  });

  app.setGlobalPrefix('api/v1', { exclude: ['healthz'] });

  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use('/uploads', express.static(uploadsDir));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<AppConfig['port']>('port') as number;
  await app.listen(port);

  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Listening on :${port}`);
  logger.log(
    `CORS: ${isWildcard ? 'wildcard (dev)' : corsOrigins.join(', ')}`,
  );
  logger.log(`Body limit: ${bodyLimit}`);
  logger.log(`Uploads: ${uploadsDir}`);
  logger.log('Health: /healthz');
}

bootstrap().catch((err) => {
  // Surface Joi / config / DB errors with a non-zero exit before the
  // orchestrator decides the pod is healthy.
  // eslint-disable-next-line no-console
  console.error('[bootstrap] fatal:', err.message ?? err);
  process.exit(1);
});
