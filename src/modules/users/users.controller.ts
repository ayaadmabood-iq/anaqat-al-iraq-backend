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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in the caller\'s store (OWNER/MANAGER)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async createUser(
    @CurrentUser() user: JwtPayload,
    @Body() data: CreateUserDto,
  ) {
    return this.usersService.createUser(user.storeId, data);
  }

  @Get()
  @ApiOperation({ summary: 'List users of the caller\'s store' })
  async getUsers(@CurrentUser() user: JwtPayload) {
    return this.usersService.getUsersByStore(user.storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a user by id (same store)' })
  async getUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    return this.usersService.getUserById(userId, user.storeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (OWNER/MANAGER)' })
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
  @ApiOperation({ summary: 'Delete a user (OWNER only)' })
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
