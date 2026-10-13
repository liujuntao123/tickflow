'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { Spinner } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'authed') router.replace('/today');
  }, [status, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/15" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">TickFlow</h1>
            <p className="mt-1 text-[13px] text-zinc-400">自托管任务管理</p>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
          {status === 'loading' ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            children
          )}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">M1 · Web 桌面端</p>
      </div>
    </div>
  );
}