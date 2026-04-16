import { IsString, IsNotEmpty, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AddSizeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  size: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;
}
