'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useDueNotifications } from '@/lib/notifications';
import { Sidebar } from '@/components/app/sidebar';
import { Spinner } from '@/components/ui';

/** 仅登录后挂载：页面打开期间每分钟检查即将到期的任务。 */
function NotificationWatcher() {
  useDueNotifications();
  return null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  if (status !== 'authed') {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <NotificationWatcher />
      <Sidebar />
      <main className="flex min-w-0 flex-1">{children}</main>
    </div>
  );
}