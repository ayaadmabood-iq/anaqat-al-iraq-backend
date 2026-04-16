import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AudienceTag } from '@/database';

export class CreateItemDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  primaryColor: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  colorFamily?: string;

  @IsString()
  @IsOptional()
  styleTag?: string;

  @IsEnum(AudienceTag)
  @IsOptional()
  audienceTag?: AudienceTag;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  sizes?: Array<{
    size: string;
    quantity: number;
  }>;
}
