import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@/database';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  /**
   * Bootstrap-only endpoint.
   *
   * Before this change /auth/register was effectively public — anyone who
   * knew a storeId could create an account in any role (including OWNER).
   * We now reject the call unless the target store has zero users, i.e.
   * only the very first user of a fresh store can be created this way.
   * Subsequent users must be created via POST /users by an OWNER/MANAGER
   * (which is already guarded by JWT + RolesGuard).
   */
  async register(registerDto: RegisterDto): Promise<{ access_token: string; user: any }> {
    const { username, password, fullName, storeId, role } = registerDto;

    const storeUserCount = await this.usersRepository.count({
      where: { storeId },
    });
    if (storeUserCount > 0) {
      throw new ForbiddenException(
        'Registration is closed for this store. Ask an OWNER or MANAGER to create the account via /users.',
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = this.usersRepository.create({
      username,
      passwordHash,
      fullName,
      storeId,
      role,
    });

    await this.usersRepository.save(user);

    const payload: JwtPayload = {
      userId: user.id,
      storeId: user.storeId,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }

  async login(loginDto: LoginDto, storeId: string): Promise<{ access_token: string; user: any }> {
    const { username, password } = loginDto;

    // Find user by username and store (store-scoped users)
    const user = await this.usersRepository.findOne({
      where: {
        username,
        storeId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Generate JWT
    const payload: JwtPayload = {
      userId: user.id,
      storeId: user.storeId,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }

  async validateUser(userId: string, storeId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id: userId,
        storeId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
