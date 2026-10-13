'use client';

import { useEffect } from 'react';
import { useAllTasks } from './hooks/use-tasks';
import { useUiStore } from './ui-store';

const STORAGE_KEY = 'tf-notified-tasks';
/** 超过到期时间多久后不再补发通知 */
const STALE_MS = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

function loadNotified(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotified(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
}

export function notificationSupport(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * 页面内定时检查“即将到期”的任务并弹出浏览器通知（仅页面打开时生效）。
 * 触发条件：now ≥ 有效到期 − 最大提醒偏移，且该任务本次未通知过。
 */
export function useDueNotifications() {
  const { data: tasks = [] } = useAllTasks();

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const check = () => {
      if (Notification.permission !== 'granted') return;
      const notified = loadNotified();
      const now = Date.now();
      const aliveIds = new Set(tasks.map((t) => t.id));
      // 清理已删除/已完成任务的记录，避免 localStorage 无限增长
      for (const id of [...notified]) if (!aliveIds.has(id)) notified.delete(id);

      let changed = false;
      for (const task of tasks) {
        if (task.status === 2) continue;
        const dueRaw = task.nextDueDate ?? task.dueDate;
        if (!dueRaw) continue;
        const due = new Date(dueRaw).getTime();
        if (Number.isNaN(due)) continue;

        const offsets = (task.reminders ?? []).map((r) => r.offset);
        const leadMs = (offsets.length > 0 ? Math.min(...offsets) : 0) * 60 * 1000;
        if (now < due - leadMs) continue;
        if (now > due + STALE_MS) continue;
        if (notified.has(task.id)) continue;

        notified.add(task.id);
        changed = true;
        try {
          const notification = new Notification('任务即将到期', { body: task.title, tag: task.id });
          notification.onclick = () => {
            window.focus();
            useUiStore.getState().selectTask(task.id);
            notification.close();
          };
        } catch {
          /* 部分浏览器在非 https 下会抛错 */
        }
      }
      if (changed) saveNotified(notified);
    };

    check();
    const timer = window.setInterval(check, TICK_MS);
    return () => window.clearInterval(timer);
  }, [tasks]);
}