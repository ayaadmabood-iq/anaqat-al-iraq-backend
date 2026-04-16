import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateStoreDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
