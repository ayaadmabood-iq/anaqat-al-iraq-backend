import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import { Request } from 'express';
import type { AppConfig } from '@/config/configuration';
import { InventoryService } from './inventory.service';
import { ClassificationService } from './classification.service';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReduceStockDto } from './dto/reduce-stock.dto';
import { AddSizeDto } from './dto/add-size.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ListItemsQueryDto } from './dto/list-items.query';

/**
 * Multer storage configuration.
 * Files are saved to the uploads/ directory with UUID filenames.
 * The uploads/ directory is served as static files at /uploads/* (configured in main.ts).
 */
const imageStorage = diskStorage({
  destination: (req, file, cb) => {
    // Use process.cwd() instead of __dirname to avoid ts-node vs compiled path differences.
    // process.cwd() = the directory from which `npm run start:dev` is invoked (backend/).
    // This matches the path calculated in main.ts: path.join(__dirname, '..', 'uploads')
    // which also resolves to backend/uploads/ in both ts-node and compiled contexts.
    const uploadsDir =
      process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileExt = extname(file.originalname).toLowerCase() || '.jpg';
    const fileName = `${uuid()}${fileExt}`;
    cb(null, fileName);
  },
});

const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

@ApiTags('inventory')
@ApiBearerAuth('bearer')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private classificationService: ClassificationService,
    private config: ConfigService,
  ) {}

  @Post('items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async createItem(
    @CurrentUser() user: JwtPayload,
    @Body() createItemDto: CreateItemDto,
  ) {
    return this.inventoryService.createItem(user.storeId, createItemDto);
  }

  @Get('items')
  async getItems(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListItemsQueryDto,
  ) {
    return this.inventoryService.getItemsByStore(user.storeId, {
      categoryId: query.categoryId,
      isActive: query.isActive,
      colorFamily: query.colorFamily,
    });
  }

  @Get('items/search')
  async searchItems(
    @CurrentUser() user: JwtPayload,
    @Query('q') searchTerm: string,
  ) {
    if (!searchTerm || !searchTerm.trim()) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    return this.inventoryService.searchItems(user.storeId, searchTerm);
  }

  @Get('items/:id')
  async getItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.inventoryService.getItemById(itemId, user.storeId);
  }

  @Patch('items/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.inventoryService.updateItem(itemId, user.storeId, updateItemDto);
  }

  @Delete('items/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  async deleteItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
  ) {
    await this.inventoryService.deleteItem(itemId, user.storeId);
    return { message: 'Item deleted successfully' };
  }

  @Post('items/:id/sizes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async addSize(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body() data: AddSizeDto,
  ) {
    return this.inventoryService.addSize(itemId, user.storeId, data.size, data.quantity);
  }

  @Patch('items/:id/sizes/:size')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async updateStock(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Param('size') size: string,
    @Body() data: UpdateStockDto,
  ) {
    return this.inventoryService.updateStock(itemId, user.storeId, size, data.quantity);
  }

  @Post('items/:id/reduce-stock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SALES_STAFF, UserRole.MANAGER, UserRole.OWNER)
  async reduceStock(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body() reduceStockDto: ReduceStockDto,
  ) {
    return this.inventoryService.reduceStock(itemId, user.storeId, reduceStockDto);
  }

  @Delete('items/:id/sizes/:size')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  async removeSize(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Param('size') size: string,
  ) {
    await this.inventoryService.removeSize(itemId, user.storeId, size);
    return { message: 'Size removed successfully' };
  }

  @Get('stock/total')
  async getTotalStock(@CurrentUser() user: JwtPayload) {
    const total = await this.inventoryService.getTotalStockByStore(user.storeId);
    return { total };
  }

  /**
   * POST /inventory/upload
   *
   * Accepts a single image file (multipart/form-data, field name: "file").
   * Saves to the uploads/ directory and returns the public URL.
   *
   * The returned imageUrl is a fully qualified HTTP URL that can be:
   * 1. Stored in the ClothingItem.imageUrl column
   * 2. Used directly in Image components via { uri: imageUrl }
   * 3. Served by the backend's express.static('/uploads', ...) middleware
   *
   * For customer capture images, the same endpoint is used — returned URL
   * is passed to the recommendations flow for future AI analysis (Phase F).
   */
  @Post('upload')
  @ApiOperation({ summary: 'Upload a clothing / customer image (multipart form field "file")' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER, UserRole.SALES_STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ imageUrl: string; fileName: string }> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Build the public URL using the request host
    // In dev: http://localhost:3000/uploads/UUID.jpg
    // In prod: set APP_BASE_URL env var to override
    const configuredBase = this.config.get<AppConfig['appBaseUrl']>('appBaseUrl');
    const baseUrl = configuredBase || `${req.protocol}://${req.get('host')}`;

    const imageUrl = `${baseUrl}/uploads/${file.filename}`;

    return { imageUrl, fileName: file.filename };
  }

  @Get('categories')
  async getCategories() {
    return this.inventoryService.getCategories();
  }

  /**
   * POST /inventory/classify
   *
   * Accepts a clothing image (multipart/form-data, field name: "file") and
   * classifies it using Google Cloud Vision API.
   *
   * Uses memoryStorage — the image is NOT persisted to disk. It is read
   * into a Buffer in RAM, sent to Vision API as base64, and discarded.
   * Image persistence is handled separately by POST /inventory/upload.
   *
   * Returns VisionClassificationResult:
   *   - source: 'vision_api' | 'manual_fallback'
   *   - categoryPreset: CategoryPreset string or null (null = user must pick manually)
   *   - categoryConfidence: real Vision score, or null
   *   - primaryColorFamily / primaryColorHex: real pixel-dominant color
   *   - secondaryColorFamily / secondaryColorHex: if ≥10% coverage and different family
   *   - audienceTag: 'MEN' | 'WOMEN' | 'UNISEX' derived from Vision labels
   *   - rawLabels: all Vision label annotations (for transparency / debugging)
   *
   * If GOOGLE_VISION_API_KEY is not set in .env, returns source: 'manual_fallback'
   * with null/empty fields. The mobile review screen handles this gracefully.
   */
  @Post('classify')
  @ApiOperation({
    summary: 'Classify an image with Google Vision (opt-in)',
    description:
      'Returns `manual_fallback` when GOOGLE_VISION_API_KEY is unset, so the endpoint is safe to ship without an API key.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVENTORY_STAFF, UserRole.MANAGER, UserRole.OWNER, UserRole.SALES_STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),      // Buffer in RAM — not written to disk
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max
      },
    }),
  )
  async classifyImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    return this.classificationService.classify(file.buffer);
  }
}
