import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * GET /healthz — readiness probe.
 * Intentionally unauthenticated and exempt from rate-limiting so external
 * orchestrators / load balancers can poll it without credentials.
 * A DB round-trip is executed; if it fails, the endpoint returns 503
 * so the orchestrator can take the pod out of rotation.
 */
@ApiTags('health')
@Controller('healthz')
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 + `{status:"ok", db:"up"}` when Postgres responds. Returns 503 otherwise. Unauthenticated and throttle-exempt.',
  })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        db: 'up',
        uptimeSeconds: Math.round(process.uptime()),
      };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }
}
