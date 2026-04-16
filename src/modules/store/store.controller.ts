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
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { UserRole } from '@/database';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('stores')
@Controller('stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  /**
   * Bootstrap-only: refuses when any store already exists.
   *
   * Previously this endpoint was fully public, which on a real deployment
   * would have let any caller create unlimited tenants. Additional stores
   * now require a platform-admin path (out of scope of the v1 API); the
   * operational equivalent for now is a DBA-level INSERT.
   */
  @Post()
  @ApiOperation({
    summary: 'Create the first store (bootstrap-only)',
    description:
      'Returns 403 if any store already exists. Use this endpoint exactly once per deployment, then create the first OWNER via /auth/register.',
  })
  async createStore(@Body() data: CreateStoreDto) {
    const existing = await this.storeService.count();
    if (existing > 0) {
      throw new ForbiddenException(
        'Store creation is closed. The first store has already been provisioned.',
      );
    }
    return this.storeService.createStore(data);
  }

  @Get()
  @ApiOperation({
    summary: 'List stores (for login store selector)',
    description:
      'Public — returns the minimal information needed by a client to render a tenant picker. No secrets are exposed.',
  })
  async getAllStores() {
    return this.storeService.getAllStores();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single store (public metadata)' })
  async getStore(@Param('id', new ParseUUIDPipe()) storeId: string) {
    return this.storeService.getStoreById(storeId);
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a store (OWNER only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async updateStore(
    @Param('id', new ParseUUIDPipe()) storeId: string,
    @Body() data: UpdateStoreDto,
  ) {
    return this.storeService.updateStore(storeId, data);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete a store (OWNER only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async deleteStore(@Param('id', new ParseUUIDPipe()) storeId: string) {
    await this.storeService.deleteStore(storeId);
    return { message: 'Store deleted successfully' };
  }
}
