import { IsUUID, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ description: 'Store UUID' })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ description: 'Free-text notes for staff', example: 'Looking for a wedding outfit' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'UNISEX'], description: 'Customer gender context' })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'UNISEX'])
  customerGender?: string;

  @ApiPropertyOptional({ description: 'Occasion context', example: 'wedding' })
  @IsOptional()
  @IsString()
  occasionContext?: string;
}
