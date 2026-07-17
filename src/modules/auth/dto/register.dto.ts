import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 200)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+0-9 \-()]{6,40}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  city?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  preferredLang?: 'ar' | 'en';

  @IsBoolean()
  privacyAccepted: boolean;

  @IsBoolean()
  termsAccepted: boolean;
}
