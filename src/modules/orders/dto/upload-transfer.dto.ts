import {
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class UploadTransferDto {
  @IsString() @Length(2, 80) transferReference: string;
  @IsNumberString() transferAmount: string;
  @IsOptional() @IsString() @Length(2, 8) transferCurrency?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'transferDate must be ISO YYYY-MM-DD',
  })
  transferDate: string;

  @IsOptional() @IsUUID() targetBankAccountId?: string;
  @IsOptional() @IsString() notes?: string;
}
