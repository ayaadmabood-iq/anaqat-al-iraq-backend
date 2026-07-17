import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @Length(2, 200)
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsObject()
  title: Record<string, string>;

  @IsOptional()
  @IsObject()
  excerpt?: Record<string, string>;

  @IsObject()
  body: Record<string, string>;

  @IsOptional()
  @IsString()
  authorDisplay?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'suspended'])
  status?: 'draft' | 'published' | 'suspended';
}

export class UpdateArticleDto {
  @IsOptional() @IsObject() title?: Record<string, string>;
  @IsOptional() @IsObject() excerpt?: Record<string, string>;
  @IsOptional() @IsObject() body?: Record<string, string>;
  @IsOptional() @IsString() authorDisplay?: string;
  @IsOptional() @IsIn(['draft', 'published', 'suspended']) status?: 'draft' | 'published' | 'suspended';
}
