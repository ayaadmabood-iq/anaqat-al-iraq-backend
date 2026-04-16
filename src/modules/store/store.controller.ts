import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StoreService } from './store.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { UserRole } from '@/database';

@Controller('stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Post()
  async createStore(
    @Body()
    data: {
      name: string;
      address?: string;
      phone?: string;
    },
  ) {
    return this.storeService.createStore(data);
  }

  @Get()
  async getAllStores() {
    return this.storeService.getAllStores();
  }

  @Get(':id')
  async getStore(@Param('id') storeId: string) {
    return this.storeService.getStoreById(storeId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async updateStore(
    @Param('id') storeId: string,
    @Body()
    data: Partial<{
      name: string;
      address: string;
      phone: string;
      isActive: boolean;
    }>,
  ) {
    return this.storeService.updateStore(storeId, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async deleteStore(@Param('id') storeId: string) {
    await this.storeService.deleteStore(storeId);
    return { message: 'Store deleted successfully' };
  }
}
