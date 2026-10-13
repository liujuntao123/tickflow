import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { HabitsService } from './habits.service';
import {
  checkSchema,
  fromTemplateSchema,
  habitCreateSchema,
  habitUpdateSchema,
  statsQuerySchema,
  uncheckSchema,
  HabitCreateDto,
  HabitUpdateDto,
} from './habits.dto';

@Controller('habits')
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.habits.list(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(habitCreateSchema)) dto: HabitCreateDto) {
    return this.habits.create(userId, dto);
  }

  @Get('stats')
  stats(@CurrentUser('userId') userId: string, @Query(new ZodValidationPipe(statsQuerySchema)) query: { from?: Date; to?: Date }) {
    return this.habits.stats(userId, query.from, query.to);
  }

  @Post('from-template')
  fromTemplate(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(fromTemplateSchema)) dto: { templateId: string }) {
    return this.habits.fromTemplate(userId, dto.templateId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(habitUpdateSchema)) dto: HabitUpdateDto,
  ) {
    return this.habits.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.habits.remove(userId, id);
  }

  @Post(':id/check')
  check(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkSchema)) dto: { date: Date; value?: number },
  ) {
    return this.habits.check(userId, id, dto.date, dto.value);
  }

  @Post(':id/uncheck')
  uncheck(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(uncheckSchema)) dto: { date: Date },
  ) {
    return this.habits.uncheck(userId, id, dto.date);
  }
}

@Controller('habit-templates')
export class HabitTemplatesController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  list() {
    return this.habits.templates();
  }
}