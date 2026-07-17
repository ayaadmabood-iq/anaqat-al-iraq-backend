import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  /**
   * TOTP code from the user's authenticator app, or a recovery code.
   * Required for accounts with `mfaEnabled`; also required for every
   * super_admin login regardless of whether MFA is enabled (the endpoint
   * refuses to log in a super_admin without MFA — bootstrap the first
   * code via /auth/mfa/setup + /auth/mfa/enable).
   */
  @IsOptional()
  @IsString()
  @Length(4, 40)
  mfaCode?: string;
}
