import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { SaveContentDto } from './dto/save-content.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { CONTENT_ADMIN } from '@/modules/auth/roles';
import type { User } from '@/database';

@Controller('content')
export class PublicContentController {
  constructor(private readonly svc: ContentService) {}

  @Get(':key')
  read(@Param('key') key: string) {
    return this.svc.getPublic(key);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CONTENT_ADMIN)
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly svc: ContentService) {}

  @Get()
  list() {
    return this.svc.listAllForAdmin();
  }

  @Get(':key')
  detail(@Param('key') key: string) {
    return this.svc.getForAdmin(key);
  }

  @Get(':key/versions')
  versions(@Param('key') key: string) {
    return this.svc.listVersions(key);
  }

  @Put(':key/draft')
  saveDraft(
    @CurrentUser() actor: User,
    @Param('key') key: string,
    @Body() dto: SaveContentDto,
    @Ip() ip: string,
  ) {
    return this.svc.saveDraft(actor, key, dto.value, ip);
  }

  @Post(':key/publish')
  publish(
    @CurrentUser() actor: User,
    @Param('key') key: string,
    @Ip() ip: string,
  ) {
    return this.svc.publish(actor, key, ip);
  }

  @Delete(':key')
  remove(
    @CurrentUser() actor: User,
    @Param('key') key: string,
    @Ip() ip: string,
  ) {
    return this.svc.remove(actor, key, ip);
  }
}
