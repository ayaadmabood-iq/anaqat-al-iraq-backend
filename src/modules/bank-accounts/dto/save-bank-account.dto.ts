import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateBankAccountDto {
  @IsString() @Length(2, 120) bankName: string;
  @IsString() @Length(2, 120) accountHolder: string;
  @IsString() @Length(2, 80) accountNumber: string;
  @IsOptional() @IsString() @Length(2, 80) iban?: string;
  @IsOptional() @IsString() @Length(2, 8) currency?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateBankAccountDto {
  @IsOptional() @IsString() @Length(2, 120) bankName?: string;
  @IsOptional() @IsString() @Length(2, 120) accountHolder?: string;
  @IsOptional() @IsString() @Length(2, 80) accountNumber?: string;
  @IsOptional() @IsString() @Length(2, 80) iban?: string;
  @IsOptional() @IsString() @Length(2, 8) currency?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
