import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface SearchResult {
  type: 'task' | 'list' | 'tag';
  id: string;
  title: string;
  subtitle?: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, q: string, types: string[], limit: number) {
    const results: SearchResult[] = [];
    const wanted = new Set(types);

    if (wanted.has('task')) {
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { notes: { contains: q, mode: 'insensitive' } }],
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        select: { id: true, title: true, notes: true },
      });
      for (const t of tasks) {
        results.push({ type: 'task', id: t.id, title: t.title, subtitle: t.notes ? t.notes.slice(0, 120) : undefined });
      }
    }

    if (wanted.has('list')) {
      const lists = await this.prisma.list.findMany({
        where: { userId, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
        orderBy: [{ sortOrder: 'asc' }],
        take: limit,
        select: { id: true, name: true, isInbox: true },
      });
      for (const l of lists) {
        results.push({ type: 'list', id: l.id, title: l.name, subtitle: l.isInbox ? '收件箱' : undefined });
      }
    }

    if (wanted.has('tag')) {
      const tags = await this.prisma.tag.findMany({
        where: { userId, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
        orderBy: [{ sortOrder: 'asc' }],
        take: limit,
        select: { id: true, name: true },
      });
      for (const t of tags) {
        results.push({ type: 'tag', id: t.id, title: t.name });
      }
    }

    return { results: results.slice(0, limit) };
  }
}