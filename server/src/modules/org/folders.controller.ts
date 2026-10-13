import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { FoldersService } from './folders.service';
import { folderCreateSchema, folderDeleteQuerySchema, folderUpdateSchema, reorderSchema } from './org.dto';

@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.folders.list(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(folderCreateSchema)) dto: { name: string; color?: number }) {
    return this.folders.create(userId, dto);
  }

  @Post('reorder')
  reorder(@CurrentUser('userId') userId: string, @Body(new ZodValidationPipe(reorderSchema)) dto: { orderedIds: string[] }) {
    return this.folders.reorder(userId, dto.orderedIds);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(folderUpdateSchema)) dto: { name?: string; color?: number | null; sortOrder?: number },
  ) {
    return this.folders.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(folderDeleteQuerySchema)) query: { strategy?: 'inbox' | 'cascade' },
  ) {
    return this.folders.remove(userId, id, query.strategy ?? 'inbox');
  }
}