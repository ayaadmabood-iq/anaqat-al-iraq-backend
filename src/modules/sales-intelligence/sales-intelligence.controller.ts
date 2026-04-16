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
    throw new NotImplementedException();
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List customer sessions for a store' })
  async listSessions(@Query() query: ListSessionsQueryDto) {
    throw new NotImplementedException();
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session detail including recommendations' })
  async getSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    throw new NotImplementedException();
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
        destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
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
    throw new NotImplementedException();
  }

  // ── Job polling ───────────────────────────────────────────────────────────

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll AI processing job status' })
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ) {
    throw new NotImplementedException();
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
}
