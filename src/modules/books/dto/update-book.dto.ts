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

const REL_PATH = /^[a-z0-9][a-z0-9/_.-]{0,499}$/i;

export class UpdateBookDto {
  @IsOptional() @IsObject() title?: Record<string, string>;
  @IsOptional() @IsObject() author?: Record<string, string>;
  @IsOptional() @IsObject() description?: Record<string, string>;
  @IsOptional() @IsString() @Matches(REL_PATH) masterPdfPath?: string;
  @IsOptional() @IsString() @Length(1, 16) editionVersion?: string;
  @IsOptional() @IsString() @Matches(REL_PATH) samplePdfPath?: string;
  @IsOptional() @IsString() @Matches(REL_PATH) coverImagePath?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsArray() keywords?: string[];
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsInt() @Min(0) pageCount?: number;
  @IsOptional() @IsNumberString() priceUsd?: string;
  @IsOptional() @IsNumberString() priceIqd?: string;
  @IsOptional() @IsIn(['draft', 'published', 'suspended']) status?: 'draft' | 'published' | 'suspended';
}
