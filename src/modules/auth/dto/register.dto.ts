import { IsString, IsNotEmpty, MinLength, IsUUID, IsEnum } from 'class-validator';
import { UserRole } from '@/database';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @IsEnum(UserRole)
  role: UserRole;
}
