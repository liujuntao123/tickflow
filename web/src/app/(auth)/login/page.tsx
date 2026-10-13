'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { login } from '@/lib/hooks/use-auth';
import { useSession } from '@/lib/session';
import { Button, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const setAccessToken = useSession((s) => s.setAccessToken);
  const setUser = useSession((s) => s.setUser);
  const setStatus = useSession((s) => s.setStatus);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
      setStatus('authed');
      router.replace('/today');
    },
    onError: (e) => setError(e instanceof Error ? e.message : '登录失败，请重试'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate({ email: email.trim(), password });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">登录</h2>
        <p className="mt-1 text-[13px] text-zinc-400">使用邮箱与密码继续</p>
      </div>

      <Field label="邮箱">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="密码">
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" loading={mutation.isPending}>
        登录
      </Button>

      <p className="text-center text-[13px] text-zinc-500">
        还没有账号？{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          注册
        </Link>
      </p>
    </form>
  );
}