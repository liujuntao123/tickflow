import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.tag.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
  }

  async create(userId: string, dto: { name: string; color?: number }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const max = await tx.tag.aggregate({ where: { userId, deletedAt: null }, _max: { sortOrder: true } });
      return tx.tag.create({
        data: {
          userId,
          name: dto.name,
          color: dto.color ?? null,
          sortOrder: BigInt(max._max.sortOrder ?? 0n) + 1024n,
          seq: BigInt(alloc()),
          lwwAt: new Date(),
          lwwDevice: SERVER_DEVICE,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: { name?: string; color?: number | null; sortOrder?: number }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const existing = await tx.tag.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw AppException.notFound('标签不存在', 'TAG_NOT_FOUND');
      const data: Prisma.TagUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.color !== undefined) data.color = dto.color;
      if (dto.sortOrder !== undefined) data.sortOrder = BigInt(dto.sortOrder);
      return tx.tag.update({ where: { id }, data });
    });
  }

  async remove(userId: string, id: string) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const tag = await tx.tag.findFirst({ where: { id, userId, deletedAt: null } });
      if (!tag) throw AppException.notFound('标签不存在', 'TAG_NOT_FOUND');
      await tx.taskTag.deleteMany({ where: { userId, tagId: id } });
      await tx.tag.update({
        where: { id },
        data: { deletedAt: new Date(), seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
      return { ok: true };
    });
  }

  async merge(userId: string, fromId: string, toId: string) {
    if (fromId === toId) throw AppException.badRequest('fromId 与 toId 不能相同', 'INVALID_MERGE');
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const [from, to] = await Promise.all([
        tx.tag.findFirst({ where: { id: fromId, userId, deletedAt: null } }),
        tx.tag.findFirst({ where: { id: toId, userId, deletedAt: null } }),
      ]);
      if (!from) throw AppException.notFound('源标签不存在', 'TAG_NOT_FOUND');
      if (!to) throw AppException.notFound('目标标签不存在', 'TAG_NOT_FOUND');

      // 关系表不进同步流，直接重建指向
      await tx.$executeRaw`
        INSERT INTO task_tags (task_id, tag_id, user_id, created_at)
        SELECT task_id, ${toId}::uuid, user_id, now()
        FROM task_tags WHERE tag_id = ${fromId}::uuid AND user_id = ${userId}::uuid
        ON CONFLICT (task_id, tag_id) DO NOTHING`;
      await tx.taskTag.deleteMany({ where: { userId, tagId: fromId } });
      const now = new Date();
      await tx.tag.update({
        where: { id: fromId },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true };
    });
  }

  async reorder(userId: string, orderedIds: string[]) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const now = new Date();
      for (let i = 0; i < orderedIds.length; i += 1) {
        const updated = await tx.tag.updateMany({
          where: { id: orderedIds[i], userId, deletedAt: null },
          data: { sortOrder: BigInt(i) * 1024n, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        if (updated.count === 0) throw AppException.notFound(`标签不存在: ${orderedIds[i]}`, 'TAG_NOT_FOUND');
      }
      return { ok: true };
    });
  }
}