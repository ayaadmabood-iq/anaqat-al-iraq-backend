import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import {
  CUSTOMER_SUPPORT_ADMIN,
  OWNER_ONLY,
} from '@/modules/auth/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly svc: UsersService) {}

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get()
  list(@Query('q') q?: string) {
    return this.svc.listForAdmin(q);
  }

  @Roles(...CUSTOMER_SUPPORT_ADMIN)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @Roles(...OWNER_ONLY)
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.svc.setActive(id, false);
  }

  @Roles(...OWNER_ONLY)
  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.svc.setActive(id, true);
  }
}
