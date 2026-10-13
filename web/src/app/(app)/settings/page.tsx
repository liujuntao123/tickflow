'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut } from 'lucide-react';
import { useSettings, useUpdateProfile, useUpdateSettings } from '@/lib/hooks/use-settings';
import { logout } from '@/lib/hooks/use-auth';
import { notificationSupport, requestNotificationPermission } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { ThemeSwitch } from '@/components/app/theme-switch';

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

const MODULES: { key: 'modulePomodoro' | 'moduleHabits' | 'moduleMatrix' | 'moduleCalendar'; label: string; desc: string }[] = [
  { key: 'modulePomodoro', label: '专注 / 番茄钟', desc: '在专注计时器中管理专注会话' },
  { key: 'moduleHabits', label: '习惯打卡', desc: '记录并追踪每日习惯' },
  { key: 'moduleMatrix', label: '四象限', desc: '按重要 / 紧急组织任务' },
  { key: 'moduleCalendar', label: '日历视图', desc: '以日历方式查看任务' },
];

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const clearSession = useSession((s) => s.clear);

  const { data: settings, isLoading } = useSettings();
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings();

  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [saved, setSaved] = useState(false);
  const [permission, setPermission] = useState<ReturnType<typeof notificationSupport>>('default');

  useEffect(() => {
    setPermission(notificationSupport());
  }, []);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setTimezone(user?.timezone ?? 'Asia/Shanghai');
  }, [user]);

  async function saveProfile() {
    const res = await updateProfile.mutateAsync({
      displayName: displayName.trim() || undefined,
      timezone,
    });
    if (res?.user) setUser(res.user);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    clearSession();
    qc.clear();
    router.replace('/login');
  }

  return (
    <div className="tf-scroll h-full min-w-0 flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">设置</h1>

        <Card title="个人资料">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="显示名">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="时区">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-brand-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {!TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" size="sm" loading={updateProfile.isPending} onClick={saveProfile}>
              保存
            </Button>
            {saved && <span className="text-[12px] text-emerald-600 dark:text-emerald-400">已保存</span>}
            <span className="text-[12px] text-zinc-400">{user?.email}</span>
          </div>
        </Card>

        <Card title="模块开关" className="mt-5">
          {isLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {MODULES.map((m) => (
                <div key={m.key} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[14px] text-zinc-800 dark:text-zinc-100">{m.label}</p>
                    <p className="text-[12px] text-zinc-400">{m.desc}</p>
                  </div>
                  <Toggle
                    checked={!!settings?.[m.key]}
                    onChange={(v) => updateSettings.mutate({ [m.key]: v })}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="浏览器通知" className="mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] text-zinc-800 dark:text-zinc-100">任务到期通知</p>
              <p className="mt-0.5 text-[12px] text-zinc-400">
                {permission === 'granted'
                  ? '已开启，页面打开时每分钟检查一次即将到期的任务。'
                  : permission === 'denied'
                    ? '浏览器已拒绝通知权限，请在地址栏的站点设置中重新允许。'
                    : permission === 'unsupported'
                      ? '当前浏览器不支持通知。'
                      : '开启后，即将到期（按提醒偏移）的任务会弹出系统通知（仅页面打开时生效）。'}
              </p>
            </div>
            <Button
              size="sm"
              variant={permission === 'granted' ? 'secondary' : 'primary'}
              disabled={permission === 'granted' || permission === 'unsupported'}
              onClick={async () => setPermission(await requestNotificationPermission())}
            >
              <Bell className="h-4 w-4" />
              {permission === 'granted' ? '已开启' : '开启浏览器通知'}
            </Button>
          </div>
        </Card>

        <Card title="外观" className="mt-5">
          <div className="max-w-xs">
            <ThemeSwitch />
          </div>
          <p className="mt-2 text-[12px] text-zinc-400">主题会同步保存到服务端设置。</p>
        </Card>

        <Card title="账号" className="mt-5">
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <h2 className="mb-4 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-zinc-200 dark:bg-zinc-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}