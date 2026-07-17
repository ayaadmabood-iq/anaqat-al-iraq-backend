import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { ForensicReportService } from './forensic-report.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import {
  ANY_ADMIN,
  CUSTOMER_SUPPORT_ADMIN,
  FINANCE_ADMIN,
} from '@/modules/auth/roles';
import { safeFilename } from '@/modules/common/safe-path';
import type { User } from '@/database';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly svc: AdminService,
    private readonly forensic: ForensicReportService,
  ) {}

  @Roles(...ANY_ADMIN)
  @Get('summary')
  summary() {
    return this.svc.summary();
  }

  @Roles(...FINANCE_ADMIN)
  @Get('reports/sales')
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.salesReport(from, to);
  }

  @Roles(...ANY_ADMIN)
  @Get('reports/best-selling')
  bestSelling(@Query('limit') limit?: string) {
    return this.svc.bestSellingBooks(limit ? parseInt(limit, 10) : 10);
  }

  @Roles(...FINANCE_ADMIN)
  @Get('reports/pending-orders')
  pending() {
    return this.svc.pendingOrders();
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('lookup/copy/:uuid')
  lookupUuid(@Param('uuid') uuid: string) {
    return this.svc.lookupByUuid(uuid);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('lookup/copy/:uuid/report')
  @Header('Content-Type', 'application/json')
  forensicReport(@CurrentUser() user: User, @Param('uuid') uuid: string) {
    return this.forensic.build(uuid, user);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('lookup/copy/:uuid/report.pdf')
  async forensicReportPdf(
    @CurrentUser() user: User,
    @Param('uuid') uuid: string,
    @Res() res: Response,
  ) {
    const report = await this.forensic.build(uuid, user);
    const buf = await this.forensic.buildPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(`${report.reportNumber}.pdf`)}"`,
    );
    res.send(buf);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('lookup/copies')
  searchCopies(
    @Query('buyer') buyer?: string,
    @Query('order') orderNumber?: string,
  ) {
    return this.svc.searchCopies({ buyer, orderNumber });
  }
}
