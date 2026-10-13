'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useUpdateSettings } from '@/lib/hooks/use-settings';
import { applyTheme, readStoredTheme, type ThemeMode } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

export function ThemeSwitch() {
  const [mode, setMode] = useState<ThemeMode>('system');
  const updateSettings = useUpdateSettings();

  useEffect(() => {
    setMode(readStoredTheme());
  }, []);

  function choose(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
    updateSettings.mutate({ theme: next });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            onClick={() => choose(opt.value)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-lg transition-colors',
              active
                ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-700 dark:text-brand-300'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}