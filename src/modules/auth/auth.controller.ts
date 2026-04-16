import {
  Controller,
  Post,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Query('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.authService.login(loginDto, storeId);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
