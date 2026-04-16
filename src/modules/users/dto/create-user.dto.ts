import { IsString, IsNotEmpty, MinLength, MaxLength, IsEnum } from 'class-validator';
import { UserRole } from '@/database';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsEnum(UserRole)
  role: UserRole;
}
