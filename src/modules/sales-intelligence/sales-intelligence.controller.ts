import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/roles.guard';
import { Roles } from '@/modules/auth/roles.decorator';
import { CurrentUser } from '@/modules/auth/current-user.decorator';
import { JwtPayload } from '@/modules/auth/jwt.strategy';
import { UserRole } from '@/database';
import { CustomerSessionService } from './services/customer-session.service';
import { RecommendationEngineService } from './services/recommendation-engine.service';
import { OutcomeTrackingService } from './services/outcome-tracking.service';
import { AiProcessingJobService } from './services/ai-processing-job.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { ConvertRecommendationDto } from './dto/convert-recommendation.dto';

const SALES_INTELLIGENCE_ROLES = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.SALES_STAFF,
];

@ApiTags('sales-intelligence')
@ApiBearerAuth('bearer')
@Controller('sales-intelligence')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SALES_INTELLIGENCE_ROLES)
export class SalesIntelligenceController {
  constructor(
    private readonly sessionService: CustomerSessionService,
    private readonly engine: RecommendationEngineService,
    private readonly outcomeService: OutcomeTrackingService,
    private readonly jobService: AiProcessingJobService,
  ) {}

  // ── Sessions ──────────────────────────────────────────────────────────────

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer session' })
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const session = await this.sessionService.create(dto, user.userId);
    return {
      sessionId: session.id,
      storeId: session.storeId,
      status: session.sessionStatus,
      createdAt: session.createdAt,
    };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List customer sessions for a store' })
  async listSessions(@Query() query: ListSessionsQueryDto) {
    const { data, total } = await this.sessionService.findAll(query);
    return { data, total };
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session detail including recommendations' })
  async getSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    const session = await this.sessionService.findOne(sessionId);
    return this.mapSession(session);
  }

  // ── Recommendation pipeline ───────────────────────────────────────────────

  @Post('sessions/:sessionId/recommend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload photo and trigger recommendation pipeline' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
      required: ['photo'],
    },
  })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (req, file, cb) =>
          cb(null, process.env.UPLOAD_DIR || 'uploads'),
        filename: (req, file, cb) =>
          cb(null, `session-${uuid()}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        cb(
          allowed.includes(file.mimetype) ? null : new Error('Invalid file type'),
          allowed.includes(file.mimetype),
        );
      },
    }),
  )
  async recommend(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) {
      throw new BadRequestException('Photo file is required (jpeg, png, or webp, max 5MB)');
    }

    const session = await this.sessionService.findOne(sessionId);

    const result = await this.engine.run(
      sessionId,
      session.storeId,
      photo.path,
      session.occasionContext,
    );

    return {
      sessionId,
      jobId: result.jobId,
      status: 'COMPLETED',
      fallback: result.fallback || undefined,
      fallbackReason: result.fallbackReason,
      signal: result.signal
        ? {
            source: result.signal.source,
            primaryColor: result.signal.primaryColor,
            primaryHex: result.signal.primaryHex,
            audienceTag: result.signal.audienceTag,
            categoryHints: result.signal.categoryHints,
          }
        : null,
      recommendations: result.recommendations.map((r, i) =>
        this.mapRecommendation(r),
      ),
      emptyReason: result.emptyReason,
    };
  }

  // ── Job polling ───────────────────────────────────────────────────────────

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll AI processing job status' })
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ) {
    const job = await this.jobService.findOne(jobId);
    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  // ── Outcome tracking ─────────────────────────────────────────────────────

  @Patch('sessions/:sessionId/recommendations/:rank/presented')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a recommendation as presented to the customer' })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'rank', type: 'number' })
  async markPresented(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('rank', ParseIntPipe) rank: number,
  ) {
    throw new NotImplementedException();
  }

  @Post('sessions/:sessionId/recommendations/:rank/convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a recommendation to a completed sale' })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'rank', type: 'number' })
  async convert(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('rank', ParseIntPipe) rank: number,
    @Body() dto: ConvertRecommendationDto,
  ) {
    throw new NotImplementedException();
  }

  // ── Reporting ─────────────────────────────────────────────────────────────

  @Get('reports/conversion')
  @ApiOperation({ summary: 'Get recommendation conversion funnel for a store' })
  async conversionReport(
    @Query('storeId', new ParseUUIDPipe()) storeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    throw new NotImplementedException();
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private mapRecommendation(rec: any) {
    return {
      rank: rec.rank,
      outfitLabel: rec.outfitLabel,
      totalPriceIqd: rec.totalPriceIqd,
      wasPresented: rec.wasPresented,
      convertedAt: rec.convertedAt,
      convertedSaleId: rec.convertedSaleId,
      reasonAr: rec.reasonAr,
      reasonEn: rec.reasonEn,
      items: (rec.items ?? []).map((item: any) => ({
        role: item.role,
        itemId: item.clothingItemId,
        sizeSelected: item.sizeSelected,
        unitPriceIqd: item.unitPriceIqd,
        item: item.clothingItem
          ? {
              nameAr: item.clothingItem.notes ?? null,
              nameEn: item.clothingItem.styleTag ?? null,
              primaryColor: item.clothingItem.primaryColor,
              colorFamily: item.clothingItem.colorFamily,
              imageUrl: item.clothingItem.imageUrl,
            }
          : undefined,
      })),
    };
  }

  private mapSession(session: any) {
    return {
      sessionId: session.id,
      storeId: session.storeId,
      userId: session.userId,
      status: session.sessionStatus,
      notes: session.notes,
      customerGender: session.customerGender,
      occasionContext: session.occasionContext,
      customerImageUrl: session.customerImageUrl,
      createdAt: session.createdAt,
      recommendations: (session.recommendations ?? [])
        .sort((a: any, b: any) => a.rank - b.rank)
        .map((r: any) => this.mapRecommendation(r)),
    };
  }
}
