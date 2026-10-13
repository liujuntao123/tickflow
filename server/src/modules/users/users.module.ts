import { Module } from '@nestjs/common';
import { DevicesController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, DevicesController],
  providers: [UsersService],
})
export class UsersModule {}