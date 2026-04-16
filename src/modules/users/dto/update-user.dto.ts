import { IsString, IsOptional, MaxLength, IsEnum, IsBoolean } from 'class-validator';
import { UserRole } from '@/database';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
