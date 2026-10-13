import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { UsersService } from './users.service';
import { changePasswordSchema, updateMeSchema } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  updateMe(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(updateMeSchema)) dto: { displayName?: string; timezone?: string }) {
    return this.users.updateMe(userId, dto);
  }

  @Post('me/password')
  changePassword(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sid') sid: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: { oldPassword: string; newPassword: string },
  ) {
    return this.users.changePassword(userId, sid, dto);
  }
}

@Controller('devices')
export class DevicesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.users.devices(userId);
  }

  @Delete(':deviceId')
  remove(@CurrentUser('userId') userId: string, @Param('deviceId') deviceId: string) {
    return this.users.removeDevice(userId, deviceId);
  }
}