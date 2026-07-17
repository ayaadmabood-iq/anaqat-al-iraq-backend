import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 120)
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsObject()
  name: Record<string, string>;

  @IsOptional() @IsObject() description?: Record<string, string>;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsObject() name?: Record<string, string>;
  @IsOptional() @IsObject() description?: Record<string, string>;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
