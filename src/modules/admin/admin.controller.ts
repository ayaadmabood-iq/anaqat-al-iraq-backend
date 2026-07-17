import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('summary')
  summary() {
    return this.svc.summary();
  }

  @Get('reports/sales')
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.salesReport(from, to);
  }

  @Get('lookup/copy/:uuid')
  lookupUuid(@Param('uuid') uuid: string) {
    return this.svc.lookupByUuid(uuid);
  }
}
