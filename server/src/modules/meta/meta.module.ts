import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../common/decorators';

@Controller('meta')
export class MetaController {
  @Public()
  @Get()
  meta() {
    return {
      version: process.env.APP_VERSION ?? '0.0.1',
      modules: { pomodoro: true, habits: true, matrix: true, calendar: true },
    };
  }
}

@Module({ controllers: [MetaController] })
export class MetaModule {}