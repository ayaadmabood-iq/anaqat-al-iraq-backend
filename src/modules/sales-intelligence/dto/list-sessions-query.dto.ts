import { IsUUID, IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class ListSessionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by store UUID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'RECOMMENDATION_READY', 'CONVERTED', 'ABANDONED'] })
  @IsOptional()
  @IsIn(['OPEN', 'RECOMMENDATION_READY', 'CONVERTED', 'ABANDONED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by staff user UUID' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
