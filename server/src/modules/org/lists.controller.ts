import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ListsService } from './lists.service';
import { archiveSchema, listCreateSchema, listQuerySchema, listUpdateSchema, reorderSchema } from './org.dto';

@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: { folderId?: string; includeArchived?: boolean },
  ) {
    return this.lists.list(userId, query);
  }

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(listCreateSchema))
    dto: { name: string; folderId?: string | null; color?: number | null; icon?: string | null },
  ) {
    return this.lists.create(userId, dto);
  }

  @Post('reorder')
  reorder(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(reorderSchema)) dto: { orderedIds: string[] }) {
    return this.lists.reorder(userId, dto.orderedIds);
  }

  @Post(':id/archive')
  archive(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(archiveSchema)) dto: { archived?: boolean },
  ) {
    return this.lists.archive(userId, id, dto.archived ?? true);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(listUpdateSchema))
    dto: { name?: string; folderId?: string | null; color?: number | null; icon?: string | null; sortOrder?: number; isArchived?: boolean },
  ) {
    return this.lists.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.lists.remove(userId, id);
  }
}