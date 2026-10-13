import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { SyncService } from './sync.service';
import { syncSchema, SyncDto } from './sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  run(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(syncSchema)) dto: SyncDto) {
    return this.sync.sync(userId, dto);
  }

  @Get('bootstrap')
  bootstrap(@CurrentUser('userId') userId: string) {
    return this.sync.bootstrap(userId);
  }
}