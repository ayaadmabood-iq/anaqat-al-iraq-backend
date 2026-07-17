import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(3, 200) fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+0-9 \-()]{6,40}$/)
  phone?: string;

  @IsOptional() @IsString() @Length(2, 100) country?: string;
  @IsOptional() @IsString() @Length(2, 100) city?: string;
  @IsOptional() @IsIn(['ar', 'en']) preferredLang?: 'ar' | 'en';
}
