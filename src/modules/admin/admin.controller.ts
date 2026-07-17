import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import {
  ANY_ADMIN,
  CUSTOMER_SUPPORT_ADMIN,
  FINANCE_ADMIN,
} from '@/modules/auth/roles';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

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
  forensicReport(@Param('uuid') uuid: string) {
    return this.svc.forensicReport(uuid);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get('lookup/copies')
  searchCopies(@Query('buyer') buyer?: string, @Query('order') orderNumber?: string) {
    return this.svc.searchCopies({ buyer, orderNumber });
  }
}
