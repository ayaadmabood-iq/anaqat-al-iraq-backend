import {
  Controller,
  Post,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** Exchange username+password for a JWT scoped to a specific store. */
  @Post('login')
  @ApiOperation({
    summary: 'Login within a store',
    description:
      'Returns `{ access_token, user }`. The storeId query param is required.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Query('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
  ) {
    return this.authService.login(loginDto, storeId);
  }

  /** Bootstrap-only: creates the very first user of an empty store. */
  @Post('register')
  @ApiOperation({
    summary: 'Bootstrap the first user of a store',
    description:
      'Succeeds only when the target store has zero users. Subsequent users must be created via POST /users by an OWNER or MANAGER.',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
