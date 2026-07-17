import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UploadTransferDto } from './dto/upload-transfer.dto';
import { RejectOrderDto } from './dto/review-order.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { User } from '@/database';

const transferStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir =
      process.env.TRANSFERS_DIR ||
      join(process.env.STORAGE_ROOT || join(process.cwd(), 'storage'), 'transfers');
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname || '').toLowerCase();
    cb(null, `${randomUUID()}${ext || '.bin'}`);
  },
});

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto, @Ip() ip: string) {
    return this.svc.create(user, dto, ip);
  }

  @Get()
  mine(@CurrentUser() user: User) {
    return this.svc.listMine(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.getMine(user, id);
  }

  @Post(':id/transfer-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: transferStorage,
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp)$|^application\/pdf$/.test(file.mimetype);
        if (!ok) cb(new Error('file type not allowed'), false);
        else cb(null, true);
      },
    }),
  )
  uploadTransfer(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UploadTransferDto,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.svc.attachTransferProof(user, id, dto, file, ip);
  }
}

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.svc.listForAdmin(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() admin: User, @Param('id') id: string, @Ip() ip: string) {
    return this.svc.approve(admin, id, ip);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() dto: RejectOrderDto,
    @Ip() ip: string,
  ) {
    return this.svc.reject(admin, id, dto.reason, ip);
  }
}
