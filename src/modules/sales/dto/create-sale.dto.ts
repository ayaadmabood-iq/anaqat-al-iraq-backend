import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsNotEmpty()
  lines: Array<{
    clothingItemId: string;
    size: string;
    quantity: number;
    unitPrice?: number;
  }>;
}
