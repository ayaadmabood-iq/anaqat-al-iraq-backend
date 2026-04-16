import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class ReduceStockDto {
  @IsString()
  @IsNotEmpty()
  size: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}
