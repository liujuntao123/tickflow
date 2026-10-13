import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { TagsService } from './tags.service';
import { reorderSchema, tagCreateSchema, tagMergeSchema, tagUpdateSchema } from './org.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.tags.list(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(tagCreateSchema)) dto: { name: string; color?: number }) {
    return this.tags.create(userId, dto);
  }

  @Post('reorder')
  reorder(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(reorderSchema)) dto: { orderedIds: string[] }) {
    return this.tags.reorder(userId, dto.orderedIds);
  }

  @Post('merge')
  merge(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(tagMergeSchema)) dto: { fromId: string; toId: string }) {
    return this.tags.merge(userId, dto.fromId, dto.toId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(tagUpdateSchema)) dto: { name?: string; color?: number | null; sortOrder?: number },
  ) {
    return this.tags.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.tags.remove(userId, id);
  }
}