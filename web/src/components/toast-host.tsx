'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast, type ToastTone } from '@/lib/toast';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
};

const TONE_ICON = { info: Info, success: CheckCircle2, error: AlertCircle };

export function ToastHost() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((item) => {
        const Icon = TONE_ICON[item.tone];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              'tf-fade-in pointer-events-auto flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] shadow-lg shadow-zinc-900/5',
              TONE_CLASS[item.tone],
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.message}</span>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => dismiss(item.id)}
              className="ml-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}