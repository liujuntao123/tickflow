import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { SettingsService } from './settings.service';
import { settingsUpdateSchema, SettingsUpdateDto } from './settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser('userId') userId: string) {
    return this.settings.get(userId);
  }

  @Put()
  update(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(settingsUpdateSchema)) dto: SettingsUpdateDto) {
    return this.settings.update(userId, dto);
  }
}