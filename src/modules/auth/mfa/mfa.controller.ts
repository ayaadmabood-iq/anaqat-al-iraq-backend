import {
  Body,
  Controller,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { User } from '@/database';

class MfaCodeDto {
  @IsString()
  @Length(4, 40)
  code: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('setup')
  setup(@CurrentUser() user: User) {
    return this.mfa.beginEnrolment(user);
  }

  @HttpCode(200)
  @Post('enable')
  enable(
    @CurrentUser() user: User,
    @Body() dto: MfaCodeDto,
    @Ip() ip: string,
  ) {
    return this.mfa.enable(user, dto.code, ip);
  }

  @HttpCode(200)
  @Post('disable')
  disable(
    @CurrentUser() user: User,
    @Body() dto: MfaCodeDto,
    @Ip() ip: string,
  ) {
    return this.mfa.disable(user, dto.code, ip);
  }
}
