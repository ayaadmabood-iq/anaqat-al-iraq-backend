import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/database';
import type { AppConfig } from '@/config/configuration';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    /**
     * registerAsync is required: `register({ secret: process.env.JWT_SECRET })`
     * evaluates at module-import time, before ConfigModule runs — that caused
     * tokens to be signed with the fallback secret while JwtStrategy verified
     * with the .env secret, producing 401 on every protected route.
     * Using the factory below guarantees both sign and verify read the same
     * validated value from ConfigService.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<AppConfig['jwt']>('jwt');
        if (!jwt?.secret) {
          // Should be impossible because validationSchema makes JWT_SECRET
          // required, but fail loudly if it ever is.
          throw new Error('JWT secret not configured');
        }
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.expiresIn },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
