'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/hooks/use-settings';
import { useToast } from '@/lib/toast';
import { Spinner } from '@/components/ui';

export type ModuleKey = 'modulePomodoro' | 'moduleHabits' | 'moduleMatrix' | 'moduleCalendar';

export const MODULE_LABELS: Record<ModuleKey, string> = {
  modulePomodoro: '专注',
  moduleHabits: '习惯打卡',
  moduleMatrix: '四象限',
  moduleCalendar: '日历',
};

/**
 * 模块开关守卫：设置中关闭对应模块时，直接访问其路由会重定向到 /today 并给出轻提示。
 */
export function ModuleGate({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { data: settings, isLoading } = useSettings();
  const router = useRouter();
  const push = useToast((s) => s.push);
  const notified = useRef(false);

  const disabled = settings?.[module] === false;

  useEffect(() => {
    if (!disabled || notified.current) return;
    notified.current = true;
    push(`${MODULE_LABELS[module]}模块已关闭，可在设置中重新开启`, 'info');
    router.replace('/today');
  }, [disabled, module, push, router]);

  if (isLoading || disabled) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return <>{children}</>;
}