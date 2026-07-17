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
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.svc.listForAdmin(q);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.svc.setActive(id, false);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.svc.setActive(id, true);
  }
}
