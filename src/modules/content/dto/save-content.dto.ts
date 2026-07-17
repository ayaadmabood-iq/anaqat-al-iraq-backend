import { IsDefined, IsString, Length } from 'class-validator';

export class SaveContentDto {
  @IsString()
  @Length(2, 80)
  key: string;

  @IsDefined()
  value: unknown;
}
