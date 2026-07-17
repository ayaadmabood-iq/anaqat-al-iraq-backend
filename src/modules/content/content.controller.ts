import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { SaveContentDto } from './dto/save-content.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CONTENT_ADMIN } from '@/modules/auth/roles';

@Controller('content')
export class PublicContentController {
  constructor(private readonly svc: ContentService) {}

  @Get(':key')
  read(@Param('key') key: string) {
    return this.svc.getPublic(key);
  }
}

@UseGuards(JwtAuthGuard)
@Roles(...CONTENT_ADMIN)
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly svc: ContentService) {}

  @Get()
  list() {
    return this.svc.listAllForAdmin();
  }

  @Put(':key')
  put(@Param('key') key: string, @Body() dto: SaveContentDto) {
    return this.svc.put(key, dto.value);
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.svc.remove(key);
  }
}
