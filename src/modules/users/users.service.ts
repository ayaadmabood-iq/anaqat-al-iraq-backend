import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@/database';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(
    storeId: string,
    data: {
      username: string;
      password: string;
      fullName: string;
      role: UserRole;
    },
  ): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: {
        username: data.username,
        storeId,
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        'User with this username already exists in this store',
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = this.usersRepository.create({
      ...data,
      passwordHash,
      storeId,
    });

    return this.usersRepository.save(user);
  }

  async getUsersByStore(storeId: string): Promise<User[]> {
    return this.usersRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserById(userId: string, storeId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id: userId,
        storeId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(
    userId: string,
    storeId: string,
    data: Partial<{
      fullName: string;
      role: UserRole;
      isActive: boolean;
    }>,
  ): Promise<User> {
    const user = await this.getUserById(userId, storeId);

    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  async deleteUser(userId: string, storeId: string): Promise<void> {
    const user = await this.getUserById(userId, storeId);
    await this.usersRepository.remove(user);
  }

  async changePassword(
    userId: string,
    storeId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.getUserById(userId, storeId);

    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
  }
}
