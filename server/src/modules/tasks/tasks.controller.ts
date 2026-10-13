import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { TasksService } from './tasks.service';
import {
  batchSchema,
  checklistReplaceSchema,
  idQuerySchema,
  moveSchema,
  taskCreateSchema,
  taskQuerySchema,
  taskReorderSchema,
  taskUpdateSchema,
  TaskCreateDto,
  TaskQueryDto,
  TaskUpdateDto,
} from './tasks.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser('userId') userId: string, @Query(new ZodValidationPipe(taskQuerySchema)) query: TaskQueryDto) {
    return this.tasks.list(userId, query);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(taskCreateSchema)) dto: TaskCreateDto) {
    return this.tasks.create(userId, dto);
  }

  @Get('trash')
  trash(@CurrentUser('userId') userId: string) {
    return this.tasks.trash(userId);
  }

  @Post('trash/empty')
  emptyTrash(@CurrentUser('userId') userId: string) {
    return this.tasks.emptyTrash(userId);
  }

  @Post('reorder')
  reorder(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(taskReorderSchema)) dto: { listId: string; parentId?: string | null; orderedIds: string[] },
  ) {
    return this.tasks.reorder(userId, dto.listId, dto.parentId ?? null, dto.orderedIds);
  }

  @Post('batch')
  batch(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(batchSchema))
    dto: { ids: string[]; action: 'complete' | 'delete' | 'move' | 'priority' | 'addTag'; payload?: { listId?: string; priority?: number; tagId?: string } },
  ) {
    return this.tasks.batch(userId, dto.ids, dto.action, dto.payload);
  }

  @Get(':id')
  get(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.tasks.get(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(taskUpdateSchema)) dto: TaskUpdateDto,
  ) {
    return this.tasks.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(idQuerySchema)) query: { hard: boolean },
  ) {
    return this.tasks.remove(userId, id, query.hard);
  }

  @Post(':id/complete')
  complete(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.tasks.complete(userId, id);
  }

  @Post(':id/uncomplete')
  uncomplete(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.tasks.uncomplete(userId, id);
  }

  @Post(':id/move')
  move(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveSchema)) dto: { listId: string; sortOrder?: number },
  ) {
    return this.tasks.move(userId, id, dto.listId, dto.sortOrder);
  }

  @Post(':id/checklist')
  checklist(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checklistReplaceSchema)) dto: { checklist: unknown[] },
  ) {
    return this.tasks.replaceChecklist(userId, id, dto.checklist);
  }
}