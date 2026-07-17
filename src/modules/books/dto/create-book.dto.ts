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
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @IsString()
  @Length(2, 160)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase kebab-case' })
  slug: string;

  @IsObject()
  title: Record<string, string>;

  @IsObject()
  author: Record<string, string>;

  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9/_.-]{0,499}$/i, {
    message: 'masterPdfPath must be relative and free of "..", spaces and backslashes',
  })
  masterPdfPath: string;

  @IsOptional() @IsString() @Length(1, 16) editionVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9/_.-]{0,499}$/i, {
    message: 'samplePdfPath must be relative and free of "..", spaces and backslashes',
  })
  samplePdfPath?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9/_.-]{0,499}$/i)
  coverImagePath?: string;

  @IsOptional() @IsUUID() categoryId?: string;

  @IsOptional() @IsArray() keywords?: string[];

  @IsOptional() @IsBoolean() isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pageCount?: number;

  @IsNumberString()
  priceUsd: string;

  @IsOptional()
  @IsNumberString()
  priceIqd?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'suspended'])
  status?: 'draft' | 'published' | 'suspended';
}
