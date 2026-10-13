import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { SearchService } from './search.service';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(@CurrentUser('userId') userId: string, @Query(new ZodValidationPipe(searchQuerySchema)) query: { q: string; types?: string; limit?: number }) {
    const types = (query.types ?? 'task,list,tag')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.search.search(userId, query.q, types, query.limit ?? 20);
  }
}