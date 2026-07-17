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
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UploadTransferDto } from './dto/upload-transfer.dto';
import { RejectOrderDto } from './dto/review-order.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import {
  ANY_ADMIN,
  CUSTOMER_ROLES,
  FINANCE_ADMIN,
} from '@/modules/auth/roles';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import {
  TRANSFER_MAX_BYTES,
  assertTransferExtension,
  isTransferMimeAllowed,
} from '@/modules/common/file-validators';
import type { User } from '@/database';

const transferStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir =
      process.env.TRANSFERS_DIR ||
      join(process.env.STORAGE_ROOT || join(process.cwd(), 'storage'), 'transfers');
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Never trust the client-supplied name in the on-disk filename.
    // We keep only the extension after validating it.
    const ext = extname(file.originalname || '').toLowerCase().slice(0, 8);
    cb(null, `${randomUUID()}${ext.match(/^\.[a-z0-9]{1,7}$/) ? ext : '.bin'}`);
  },
});

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CUSTOMER_ROLES)
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

  @Throttle({ upload: { limit: 5, ttl: 60_000 } })
  @Post(':id/transfer-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: transferStorage,
      limits: { fileSize: TRANSFER_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        try {
          assertTransferExtension(file.originalname);
          if (!isTransferMimeAllowed(file.mimetype)) {
            return cb(new Error('نوع الملف غير مسموح'), false);
          }
          cb(null, true);
        } catch (e) {
          cb(e as Error, false);
        }
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

  @Post(':id/reissue-copy')
  reissue(@CurrentUser() user: User, @Param('id') id: string, @Ip() ip: string) {
    return this.svc.reissueForCustomer(user, id, ip);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Roles(...ANY_ADMIN)
  @Get()
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.svc.listForAdmin(status, q);
  }

  @Roles(...ANY_ADMIN)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.getForAdmin(id);
  }

  @Roles(...FINANCE_ADMIN)
  @Post(':id/approve')
  approve(@CurrentUser() admin: User, @Param('id') id: string, @Ip() ip: string) {
    return this.svc.approve(admin, id, ip);
  }

  @Roles(...FINANCE_ADMIN)
  @Post(':id/reject')
  reject(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() dto: RejectOrderDto,
    @Ip() ip: string,
  ) {
    return this.svc.reject(admin, id, dto.reason, ip);
  }

  @Roles(...FINANCE_ADMIN)
  @Post(':id/admin-reissue-copy')
  adminReissue(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.svc.adminReissue(admin, id, ip);
  }
}
