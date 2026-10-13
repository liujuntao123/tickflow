import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [FoldersController, ListsController, TagsController],
  providers: [FoldersService, ListsService, TagsService],
  exports: [FoldersService, ListsService, TagsService],
})
export class OrgModule {}