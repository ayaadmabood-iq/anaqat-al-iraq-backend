import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { User } from '@/database';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.auth.register(dto, ip);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      city: user.city,
      preferredLang: user.preferredLang,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
