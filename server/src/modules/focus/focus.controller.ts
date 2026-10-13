import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { FocusService } from './focus.service';
import { focusCreateSchema, focusPatchSchema, focusStatsSchema } from './focus.dto';

@Controller('focus')
export class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Post('sessions')
  create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(focusCreateSchema)) dto: { taskId?: string | null; mode?: number; plannedSeconds: number; note?: string | null },
  ) {
    return this.focus.create(userId, dto);
  }

  @Get('sessions/current')
  current(@CurrentUser('userId') userId: string) {
    return this.focus.current(userId);
  }

  @Get('stats')
  stats(@CurrentUser('userId') userId: string, @Query(new ZodValidationPipe(focusStatsSchema)) query: { from?: Date; to?: Date }) {
    return this.focus.stats(userId, query.from, query.to);
  }

  @Patch('sessions/:id')
  patch(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(focusPatchSchema))
    dto: { action: 'pause' | 'resume' | 'complete' | 'cancel'; actualSeconds?: number; breakSeconds?: number },
  ) {
    return this.focus.patch(userId, id, dto);
  }
}