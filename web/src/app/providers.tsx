'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { refreshSession } from '@/lib/api';
import { fetchMe } from '@/lib/hooks/use-auth';
import { useSession } from '@/lib/session';
import { applyTheme, readStoredTheme } from '@/lib/theme';

let bootstrapStarted = false;

function useBootstrap() {
  const setUser = useSession((s) => s.setUser);
  const setStatus = useSession((s) => s.setStatus);
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    (async () => {
      const token = await refreshSession();
      if (!token) {
        setStatus('guest');
        return;
      }
      try {
        const me = await fetchMe();
        setUser(me.user);
        setStatus('authed');
      } catch {
        setStatus('guest');
      }
    })();
  }, [setStatus, setUser]);

  return status;
}

function useThemeInit() {
  useEffect(() => {
    applyTheme(readStoredTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (readStoredTheme() === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useBootstrap();
  useThemeInit();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function useSessionStatus() {
  return useSession((s) => s.status);
}