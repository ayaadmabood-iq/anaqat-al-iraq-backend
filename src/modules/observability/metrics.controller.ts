import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

/**
 * GET /metrics — Prometheus scrape endpoint.
 *
 * Exposes Node.js default metrics (CPU, memory, event loop lag, GC pauses,
 * process uptime, handle counts). HTTP request latency histograms are NOT
 * included here — per-request duration is already emitted by pino-http as
 * structured log lines, which is sufficient for the first ops pass. A
 * Prometheus-side histogram can be added later without changing call sites.
 *
 * Unauthenticated and throttle-exempt by design: Prometheus scrapes it
 * from a known trusted subnet (enforce via ingress / network ACL in prod).
 */
@ApiTags('metrics')
@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  private static initialised = false;

  constructor() {
    // collectDefaultMetrics() registers handlers with the global `register`;
    // calling it twice double-registers and throws. Guard with a static flag
    // so test modules and production bootstraps share the same state safely.
    if (!MetricsController.initialised) {
      collectDefaultMetrics({ prefix: 'anaqat_' });
      MetricsController.initialised = true;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Prometheus scrape endpoint (text/plain)' })
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
