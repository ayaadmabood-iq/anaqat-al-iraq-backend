import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SALES_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async createSale(
    @CurrentUser() user: JwtPayload,
    @Body() createSaleDto: CreateSaleDto,
  ) {
    return this.salesService.createSale(user.storeId, createSaleDto);
  }

  @Get()
  async getSales(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.salesService.getSalesByStore(user.storeId, limit, offset);
  }

  @Get('user/:userId')
  async getSalesByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.salesService.getSalesByUser(user.storeId, userId, limit, offset);
  }

  @Get(':id')
  async getSale(
    @CurrentUser() user: JwtPayload,
    @Param('id') saleId: string,
  ) {
    return this.salesService.getSaleById(saleId, user.storeId);
  }

  @Get('report/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  async getSalesReport(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    return this.salesService.getSalesReport(user.storeId, parsedStartDate, parsedEndDate);
  }
}
