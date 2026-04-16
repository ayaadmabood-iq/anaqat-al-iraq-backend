import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesReportQueryDto } from './dto/sales-report.query';

@ApiTags('sales')
@ApiBearerAuth('bearer')
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
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.salesService.getSalesByStore(user.storeId, limit, offset);
  }

  @Get('user/:userId')
  async getSalesByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.salesService.getSalesByUser(user.storeId, userId, limit, offset);
  }

  @Get('report/summary')
  @ApiOperation({ summary: 'Summary aggregates (MANAGER/OWNER)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  async getSalesReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: SalesReportQueryDto,
  ) {
    const parsedStartDate = query.startDate ? new Date(query.startDate) : undefined;
    const parsedEndDate = query.endDate ? new Date(query.endDate) : undefined;
    return this.salesService.getSalesReport(user.storeId, parsedStartDate, parsedEndDate);
  }

  @Get(':id')
  async getSale(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) saleId: string,
  ) {
    return this.salesService.getSaleById(saleId, user.storeId);
  }
}
