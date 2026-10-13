import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';

type Tx = Prisma.TransactionClient;

export async function getInboxListId(tx: Tx, userId: string): Promise<string> {
  const inbox = await tx.list.findFirst({ where: { userId, isInbox: true, deletedAt: null } });
  if (!inbox) throw AppException.notFound('收件箱不存在', 'INBOX_MISSING');
  return inbox.id;
}

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.folder.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: { name: string; color?: number }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const max = await tx.folder.aggregate({ where: { userId, deletedAt: null }, _max: { sortOrder: true } });
      const next = BigInt(max._max.sortOrder ?? 0n) + 1024n;
      return tx.folder.create({
        data: {
          userId,
          name: dto.name,
          color: dto.color ?? null,
          sortOrder: next,
          seq: BigInt(alloc()),
          lwwAt: new Date(),
          lwwDevice: SERVER_DEVICE,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: { name?: string; color?: number | null; sortOrder?: number }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const existing = await tx.folder.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw AppException.notFound('文件夹不存在', 'FOLDER_NOT_FOUND');
      const data: Prisma.FolderUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.color !== undefined) data.color = dto.color;
      if (dto.sortOrder !== undefined) data.sortOrder = BigInt(dto.sortOrder);
      return tx.folder.update({ where: { id }, data });
    });
  }

  async remove(userId: string, id: string, strategy: 'inbox' | 'cascade' = 'inbox') {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const folder = await tx.folder.findFirst({ where: { id, userId, deletedAt: null } });
      if (!folder) throw AppException.notFound('文件夹不存在', 'FOLDER_NOT_FOUND');

      const lists = await tx.list.findMany({ where: { userId, folderId: id, deletedAt: null } });
      const now = new Date();
      if (strategy === 'cascade') {
        const inboxId = await getInboxListId(tx, userId);
        for (const l of lists) {
          await tx.task.updateMany({
            where: { userId, listId: l.id },
            data: { listId: inboxId, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
          });
          await tx.list.update({
            where: { id: l.id },
            data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
          });
        }
      } else {
        for (const l of lists) {
          await tx.list.update({
            where: { id: l.id },
            data: { folderId: null, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
          });
        }
      }
      await tx.folder.update({
        where: { id },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true, movedLists: lists.length };
    });
  }

  async reorder(userId: string, orderedIds: string[]) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const now = new Date();
      for (let i = 0; i < orderedIds.length; i += 1) {
        const updated = await tx.folder.updateMany({
          where: { id: orderedIds[i], userId, deletedAt: null },
          data: { sortOrder: BigInt(i) * 1024n, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        if (updated.count === 0) throw AppException.notFound(`文件夹不存在: ${orderedIds[i]}`, 'FOLDER_NOT_FOUND');
      }
      return { ok: true };
    });
  }
}