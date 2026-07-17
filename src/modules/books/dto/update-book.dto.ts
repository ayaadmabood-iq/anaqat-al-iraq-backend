import {
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateBookDto {
  @IsOptional() @IsObject() title?: Record<string, string>;
  @IsOptional() @IsObject() author?: Record<string, string>;
  @IsOptional() @IsObject() description?: Record<string, string>;
  @IsOptional() @IsString() masterPdfPath?: string;
  @IsOptional() @IsString() coverImagePath?: string;
  @IsOptional() @IsInt() @Min(0) pageCount?: number;
  @IsOptional() @IsNumberString() priceUsd?: string;
  @IsOptional() @IsNumberString() priceIqd?: string;
  @IsOptional() @IsIn(['draft', 'published', 'suspended']) status?: 'draft' | 'published' | 'suspended';
}
