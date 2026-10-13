import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';
import { getInboxListId } from './folders.service';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: { folderId?: string; includeArchived?: boolean }) {
    const where: Prisma.ListWhereInput = { userId, deletedAt: null };
    if (query.folderId) where.folderId = query.folderId;
    if (!query.includeArchived) where.isArchived = false;
    return this.prisma.list.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    });
  }

  async create(
    userId: string,
    dto: { name: string; folderId?: string | null; color?: number | null; icon?: string | null },
  ) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      if (dto.folderId) {
        const folder = await tx.folder.findFirst({ where: { id: dto.folderId, userId, deletedAt: null } });
        if (!folder) throw AppException.notFound('文件夹不存在', 'FOLDER_NOT_FOUND');
      }
      const max = await tx.list.aggregate({ where: { userId, deletedAt: null }, _max: { sortOrder: true } });
      return tx.list.create({
        data: {
          userId,
          name: dto.name,
          folderId: dto.folderId ?? null,
          color: dto.color ?? null,
          icon: dto.icon ?? null,
          sortOrder: BigInt(max._max.sortOrder ?? 0n) + 1024n,
          seq: BigInt(alloc()),
          lwwAt: new Date(),
          lwwDevice: SERVER_DEVICE,
        },
      });
    });
  }

  async update(
    userId: string,
    id: string,
    dto: {
      name?: string;
      folderId?: string | null;
      color?: number | null;
      icon?: string | null;
      sortOrder?: number;
      isArchived?: boolean;
    },
  ) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const existing = await tx.list.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw AppException.notFound('清单不存在', 'LIST_NOT_FOUND');
      if (dto.folderId) {
        const folder = await tx.folder.findFirst({ where: { id: dto.folderId, userId, deletedAt: null } });
        if (!folder) throw AppException.notFound('文件夹不存在', 'FOLDER_NOT_FOUND');
      }
      const data: Prisma.ListUncheckedUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.folderId !== undefined) data.folderId = dto.folderId;
      if (dto.color !== undefined) data.color = dto.color;
      if (dto.icon !== undefined) data.icon = dto.icon;
      if (dto.sortOrder !== undefined) data.sortOrder = BigInt(dto.sortOrder);
      if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
      return tx.list.update({ where: { id }, data });
    });
  }

  async remove(userId: string, id: string) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const list = await tx.list.findFirst({ where: { id, userId, deletedAt: null } });
      if (!list) throw AppException.notFound('清单不存在', 'LIST_NOT_FOUND');
      if (list.isInbox) throw AppException.badRequest('收件箱不可删除', 'INBOX_PROTECTED');
      const inboxId = await getInboxListId(tx, userId);
      const now = new Date();
      await tx.task.updateMany({
        where: { userId, listId: id },
        data: { listId: inboxId, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      await tx.list.update({
        where: { id },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true };
    });
  }

  async archive(userId: string, id: string, archived: boolean) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const list = await tx.list.findFirst({ where: { id, userId, deletedAt: null } });
      if (!list) throw AppException.notFound('清单不存在', 'LIST_NOT_FOUND');
      return tx.list.update({
        where: { id },
        data: { isArchived: archived, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
    });
  }

  async reorder(userId: string, orderedIds: string[]) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const now = new Date();
      for (let i = 0; i < orderedIds.length; i += 1) {
        const updated = await tx.list.updateMany({
          where: { id: orderedIds[i], userId, deletedAt: null },
          data: { sortOrder: BigInt(i) * 1024n, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        if (updated.count === 0) throw AppException.notFound(`清单不存在: ${orderedIds[i]}`, 'LIST_NOT_FOUND');
      }
      return { ok: true };
    });
  }
}