import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async createUser(
    @CurrentUser() user: JwtPayload,
    @Body() data: CreateUserDto,
  ) {
    return this.usersService.createUser(user.storeId, data);
  }

  @Get()
  async getUsers(@CurrentUser() user: JwtPayload) {
    return this.usersService.getUsersByStore(user.storeId);
  }

  @Get(':id')
  async getUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    return this.usersService.getUserById(userId, user.storeId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.updateUser(userId, user.storeId, data);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  async deleteUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    await this.usersService.deleteUser(userId, user.storeId);
    return { message: 'User deleted successfully' };
  }
}
