'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/today');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Spinner className="h-5 w-5" />
    </div>
  );
}