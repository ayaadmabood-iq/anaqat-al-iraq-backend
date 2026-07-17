import {
  Controller,
  Get,
  Ip,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { DownloadsService } from './downloads.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
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
    @Res() res: Response,
  ) {
    const { absPath, downloadFileName } = await this.svc.prepareDownload(
      user,
      orderId,
      ip,
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
@Roles('admin')
@Controller('admin/downloads')
export class AdminDownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  @Get()
  recent() {
    return this.svc.allLogs();
  }

  @Get('copy/:copyId')
  forCopy(@Param('copyId') copyId: string) {
    return this.svc.logsForCopy(copyId);
  }
}
