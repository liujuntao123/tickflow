import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ViewsService } from './views.service';

const viewQuerySchema = z.object({
  groupBy: z.enum(['list', 'date', 'priority', 'quadrant']).optional(),
});
const calendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

@Controller('views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get('counts')
  counts(@CurrentUser('userId') userId: string) {
    return this.views.counts(userId);
  }

  @Get('calendar')
  calendar(@CurrentUser('userId') userId: string, @Query(new ZodValidationPipe(calendarQuerySchema)) query: { from?: Date; to?: Date }) {
    return this.views.calendar(userId, query.from, query.to);
  }

  @Get(':key')
  view(
    @CurrentUser('userId') userId: string,
    @Param('key') key: string,
    @Query(new ZodValidationPipe(viewQuerySchema)) query: { groupBy?: string },
  ) {
    return this.views.view(userId, key, query.groupBy);
  }
}