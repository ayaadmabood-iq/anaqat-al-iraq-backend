import {
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
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
  masterPdfPath: string;

  @IsOptional()
  @IsString()
  coverImagePath?: string;

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
