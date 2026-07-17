import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateBookDto {
  @IsOptional() @IsObject() title?: Record<string, string>;
  @IsOptional() @IsObject() author?: Record<string, string>;
  @IsOptional() @IsObject() description?: Record<string, string>;
  @IsOptional() @IsString() masterPdfPath?: string;
  @IsOptional() @IsString() editionVersion?: string;
  @IsOptional() @IsString() samplePdfPath?: string;
  @IsOptional() @IsString() coverImagePath?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsArray() keywords?: string[];
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsInt() @Min(0) pageCount?: number;
  @IsOptional() @IsNumberString() priceUsd?: string;
  @IsOptional() @IsNumberString() priceIqd?: string;
  @IsOptional() @IsIn(['draft', 'published', 'suspended']) status?: 'draft' | 'published' | 'suspended';
}
