import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/save-bank-account.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  activeForCheckout() {
    return this.svc.listActive();
  }
}

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin/bank-accounts')
export class AdminBankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Post()
  create(@Body() dto: CreateBankAccountDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
