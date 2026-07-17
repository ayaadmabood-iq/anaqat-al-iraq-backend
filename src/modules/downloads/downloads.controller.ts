import {
  Controller,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { DownloadsService } from './downloads.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import {
  ANY_ADMIN,
  CUSTOMER_SUPPORT_ADMIN,
} from '@/modules/auth/roles';
import type { User } from '@/database';

@UseGuards(JwtAuthGuard)
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  @Get('order/:orderId')
  async downloadOrder(
    @CurrentUser() user: User,
    @Param('orderId') orderId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    const { absPath, downloadFileName } = await this.svc.prepareDownload(
      user,
      orderId,
      ip,
      userAgent,
    );
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('generated file missing on disk');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadFileName}"`,
    );
    fs.createReadStream(absPath).pipe(res);
  }
}

@UseGuards(JwtAuthGuard)
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
