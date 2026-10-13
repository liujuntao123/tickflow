'use client';

import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export function ComingSoon({
  icon,
  title,
  description,
  features,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-zinc-50 pt-16 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-zinc-100 text-brand-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-brand-400/80">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          即将在后续里程碑上线
        </span>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>

        <ul className="mt-8 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-900">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[13px] text-zinc-500 dark:text-zinc-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}