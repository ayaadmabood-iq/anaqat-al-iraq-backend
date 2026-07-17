import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/database';
import { UsersService } from './users.service';
import { AdminCustomersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [AdminCustomersController],
  exports: [UsersService],
})
export class UsersModule {}
