import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { mountOpenApi } from './openapi';

async function bootstrap() {
  // bufferLogs: true defers log emission until the pino logger is wired.
  // Without this, the first Nest logs use the default console logger and
  // bypass pino entirely, so early boot messages would not be structured.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const logger = app.get(Logger);

  const nodeEnv = config.get<AppConfig['nodeEnv']>('nodeEnv') as string;
  const bodyLimit = config.get<AppConfig['bodyLimit']>('bodyLimit') as string;
  const corsOrigins = config.get<AppConfig['corsOrigins']>(
    'corsOrigins',
  ) as string[];

  app.use(helmet());
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

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
   * Never combine origin:'*' with credentials:true.
   */
  const isWildcard = corsOrigins.length === 1 && corsOrigins[0] === '*';
  app.enableCors({
    origin: isWildcard ? true : corsOrigins,
    credentials: !isWildcard,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['healthz', 'metrics', 'api-docs', 'api-docs-json', 'api-docs/(.*)'],
  });

  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use('/uploads', express.static(uploadsDir));

  // Mount OpenAPI/Swagger before the global ValidationPipe is set up; Swagger
  // needs to introspect decorators, not filter bodies. Spec lives at /api-docs.
  mountOpenApi(app, config.get<AppConfig['appBaseUrl']>('appBaseUrl') ?? undefined);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * Graceful shutdown:
   * enableShutdownHooks() wires SIGTERM / SIGINT to Nest's lifecycle.
   * Nest will then:
   *   1. reject new HTTP connections,
   *   2. invoke every module's onApplicationShutdown (incl. LifecycleService
   *      which emits a structured log line + TypeOrmCoreModule which calls
   *      DataSource.destroy to drain the PG pool),
   *   3. close the HTTP server,
   *   4. let the process exit naturally.
   * Without this, a SIGTERM from an orchestrator (Kubernetes / systemd)
   * would kill the process mid-request and leave Postgres connections open.
   */
  app.enableShutdownHooks();

  const port = config.get<AppConfig['port']>('port') as number;
  await app.listen(port);

  logger.log({
    event: 'listening',
    environment: nodeEnv,
    port,
    cors: isWildcard ? 'wildcard' : corsOrigins.join(','),
    bodyLimit,
    uploadsDir,
  });
}

bootstrap().catch((err) => {
  // Surface Joi / config / DB errors before the orchestrator marks the pod healthy.
  // Logger may not be up yet, so fall back to stderr.
  // eslint-disable-next-line no-console
  console.error('[bootstrap] fatal:', err?.message ?? err);
  process.exit(1);
});
