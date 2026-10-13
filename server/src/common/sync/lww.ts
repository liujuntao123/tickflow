/** 客户端逻辑时钟允许超前的最大量，防止时钟漂移霸占裁决权。 */
export const CLOCK_SKEW_MS = 2 * 60 * 1000;

/** 服务端（REST 写路径）写入时使用的 LWW 设备标识。 */
export const SERVER_DEVICE = 'server';

/** 把客户端 updatedAt 钳制到 [.., now + 2min]。 */
export function clampIncoming(value: string | Date | null | undefined, now: number = Date.now()): Date {
  let ms = now;
  if (value instanceof Date) {
    ms = value.getTime();
  } else if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) ms = parsed;
  }
  if (!Number.isFinite(ms)) ms = now;
  return new Date(Math.min(ms, now + CLOCK_SKEW_MS));
}

/**
 * LWW 判决：键为 (时间, deviceId) 字典序，大者胜；完全相等时不覆盖（幂等）。
 */
export function lwwWins(
  incomingAt: Date,
  incomingDevice: string,
  storedAt: Date | null | undefined,
  storedDevice: string | null | undefined,
): boolean {
  const a = incomingAt.getTime();
  const b = storedAt ? storedAt.getTime() : 0;
  if (a !== b) return a > b;
  return (incomingDevice ?? '') > (storedDevice ?? '');
}

/** 从存储实体中取出 LWW 键（lwwAt 缺失时回退 updatedAt）。 */
export function storedLww(entity: { lwwAt?: Date | null; lwwDevice?: string | null; updatedAt: Date }): {
  at: Date;
  device: string;
} {
  return { at: entity.lwwAt ?? entity.updatedAt, device: entity.lwwDevice ?? '' };
}