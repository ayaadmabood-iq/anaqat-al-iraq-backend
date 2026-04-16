import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
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

  async register(registerDto: RegisterDto): Promise<{ access_token: string; user: any }> {
    const { username, password, fullName, storeId, role } = registerDto;

    // Check if user already exists within this store
    const existingUser = await this.usersRepository.findOne({
      where: {
        username,
        storeId,
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists in this store');
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
