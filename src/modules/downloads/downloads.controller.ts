import {
  Controller,
  ForbiddenException,
  GoneException,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { DownloadsService } from './downloads.service';
import { DownloadLinkService } from './download-link.service';
import { safeFilename } from '@/modules/common/safe-path';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import {
  ANY_ADMIN,
  CUSTOMER_SUPPORT_ADMIN,
  CUSTOMER_ROLES,
} from '@/modules/auth/roles';
import type { User } from '@/database';

function isLegacyEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DOWNLOADS_LEGACY_ENDPOINT === 'on';
  }
  const v = process.env.DOWNLOADS_LEGACY_ENDPOINT;
  return v !== 'off';
}

@Controller('downloads')
export class DownloadsController {
  constructor(
    private readonly svc: DownloadsService,
    private readonly links: DownloadLinkService,
  ) {}

  /**
   * Buyer requests a short-TTL signed link for the personal copy of an
   * approved order. The returned URL is single-use and bound to the current
   * generation — an admin reissue invalidates any outstanding link.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CUSTOMER_ROLES)
  @Post('order/:orderId/link')
  async issueLink(@CurrentUser() user: User, @Param('orderId') orderId: string) {
    await this.svc.assertDownloadableForUser(user, orderId);
    return this.links.issue(orderId, user.id);
  }

  /**
   * Legacy JWT-authenticated download. Disabled in production by default
   * (set DOWNLOADS_LEGACY_ENDPOINT=on to re-enable). Returns 410 Gone with
   * Deprecation + Sunset headers when disabled.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CUSTOMER_ROLES)
  @Get('order/:orderId')
  async downloadOrder(
    @CurrentUser() user: User,
    @Param('orderId') orderId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    if (!isLegacyEnabled()) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', 'Tue, 31 Dec 2026 23:59:59 GMT');
      res.setHeader('Link', '</api/v1/downloads/order/:orderId/link>; rel="successor-version"');
      throw new GoneException(
        'This endpoint is deprecated. Use POST /downloads/order/:orderId/link to obtain a signed short-TTL URL.',
      );
    }
    return this.serve(orderId, user.id, ip, userAgent, res);
  }

  /**
   * Signed short-TTL endpoint. Anonymous — the signature IS the auth. The
   * token is single-use (a second GET returns 410) and bound to the current
   * generation.
   */
  @Get('signed')
  async downloadSigned(
    @Query('t') token: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    // Consume BEFORE serving so replay is caught at the DB level.
    const { orderId, userId } = await this.links.consume(token, ip);
    return this.serve(orderId, userId, ip, userAgent, res);
  }

  private async serve(
    orderId: string,
    userId: string,
    ip: string,
    userAgent: string,
    res: Response,
  ) {
    const { absPath, downloadFileName } = await this.svc.prepareDownloadForUserId(
      userId,
      orderId,
      ip,
      userAgent,
    );
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('generated file missing on disk');
    }
    // §5 headers — never let a signed link leak via cache, referrer, or
    // MIME sniffing.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(downloadFileName)}"`,
    );
    fs.createReadStream(absPath).pipe(res);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ANY_ADMIN)
@Controller('admin/downloads')
export class AdminDownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  @Get()
  recent(@Query('limit') limit?: string) {
    const n = limit ? Math.min(2000, parseInt(limit, 10) || 200) : 200;
    return this.svc.allLogs(n);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('copy/:copyId')
  forCopy(@Param('copyId') copyId: string) {
    return this.svc.logsForCopy(copyId);
  }
}
