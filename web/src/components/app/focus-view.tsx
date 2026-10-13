'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Settings2, Square, Timer } from 'lucide-react';
import { endOfDay, format, subDays, startOfDay } from 'date-fns';
import { useCurrentFocus, useCreateFocusSession, useFocusStats, usePatchFocusSession } from '@/lib/hooks/use-focus';
import { useSettings, useUpdateSettings } from '@/lib/hooks/use-settings';
import { useView } from '@/lib/hooks/use-views';
import { useSession } from '@/lib/session';
import { DEFAULT_FOCUS_SETTINGS, FOCUS_PRESETS, formatClock, formatDuration, parseFocusSettings } from '@/lib/focus-settings';
import { cn, formatDayLabel, localDateKey } from '@/lib/utils';
import { Button, Input, Spinner } from '@/components/ui';
import type { Task } from '@/lib/types';

type Phase = 'focus' | 'short' | 'long';
type RunStatus = 'idle' | 'running' | 'paused';

const PHASE_META: Record<Phase, { label: string; ring: string; track: string }> = {
  focus: { label: '专注中', ring: '#3b6fe0', track: 'rgba(59,111,224,0.14)' },
  short: { label: '短休息', ring: '#10b981', track: 'rgba(16,185,129,0.16)' },
  long: { label: '长休息', ring: '#0ea5e9', track: 'rgba(14,165,233,0.16)' },
};

const SNAPSHOT_PREFIX = 'tf-focus-';

interface Snapshot {
  sessionId: string;
  accumulated: number;
  status: RunStatus;
}

export function FocusWorkspace() {
  const timezone = useSession((s) => s.user?.timezone);
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: current, isSuccess: currentLoaded } = useCurrentFocus();
  const createSession = useCreateFocusSession();
  const patchSession = usePatchFocusSession();

  const cfg = useMemo(() => parseFocusSettings(settings?.focusSettings), [settings?.focusSettings]);

  const [phase, setPhase] = useState<Phase>('focus');
  const [status, setStatus] = useState<RunStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [planned, setPlanned] = useState(DEFAULT_FOCUS_SETTINGS.focusMinutes * 60);
  const [accumulated, setAccumulated] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const segmentStart = useRef<number | null>(null);
  const cycleCount = useRef(0);
  const finishing = useRef(false);
  const restored = useRef(false);

  /* ------------------------------- 计时 tick ------------------------------- */
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const runningMs = status === 'running' && segmentStart.current ? nowTick - segmentStart.current : 0;
  const elapsed = accumulated + Math.max(0, Math.floor(runningMs / 1000));
  const remaining = Math.max(0, planned - elapsed);

  /* --------------------------- 快照（刷新恢复用） ---------------------------- */
  const saveSnapshot = useCallback((snap: Snapshot | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (!snap) return;
      window.localStorage.setItem(`${SNAPSHOT_PREFIX}${snap.sessionId}`, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }, []);

  const readSnapshot = useCallback((id: string): Snapshot | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(`${SNAPSHOT_PREFIX}${id}`);
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }, []);

  /* ----------------------------- 恢复未结束会话 ----------------------------- */
  useEffect(() => {
    if (!currentLoaded || restored.current) return;
    restored.current = true;
    if (!current) return;
    const snap = readSnapshot(current.id);
    setSessionId(current.id);
    setPhase('focus');
    setPlanned(current.plannedSeconds);
    setTaskId(current.taskId ?? '');
    if (current.status === 1) {
      const base = snap?.accumulated ?? Math.max(0, Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 1000));
      setAccumulated(base);
      setStatus('paused');
      segmentStart.current = null;
    } else {
      const startedAt = new Date(current.startedAt).getTime();
      const base = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setAccumulated(base);
      setStatus('running');
      segmentStart.current = Date.now();
    }
  }, [currentLoaded, current, readSnapshot]);

  /* ------------------------------- 状态推进 -------------------------------- */
  const finishFocus = useCallback(
    async (action: 'complete' | 'cancel') => {
      if (!sessionId || finishing.current) return;
      finishing.current = true;
      const actual = accumulated + (status === 'running' && segmentStart.current ? Math.floor((Date.now() - segmentStart.current) / 1000) : 0);
      try {
        await patchSession.mutateAsync({ id: sessionId, action, actualSeconds: actual });
      } catch {
        /* 后端失败也不阻塞本地状态 */
      }
      finishing.current = false;
      setSessionId(null);
      segmentStart.current = null;
      setAccumulated(0);
      if (action === 'complete') {
        cycleCount.current += 1;
        const long = cfg.longBreakEvery > 0 && cycleCount.current % cfg.longBreakEvery === 0;
        const nextPhase: Phase = long ? 'long' : 'short';
        setPhase(nextPhase);
        setPlanned((long ? cfg.longBreakMinutes : cfg.shortBreakMinutes) * 60);
        if (cfg.autoStartNext) {
          setStatus('running');
          segmentStart.current = Date.now();
        } else {
          setStatus('idle');
        }
      } else {
        setPhase('focus');
        setPlanned(cfg.focusMinutes * 60);
        setStatus('idle');
      }
    },
    [accumulated, cfg, patchSession, sessionId, status],
  );

  const startFocus = useCallback(async () => {
    const seconds = cfg.focusMinutes * 60;
    setPhase('focus');
    setPlanned(seconds);
    setAccumulated(0);
    segmentStart.current = Date.now();
    setStatus('running');
    try {
      const session = await createSession.mutateAsync({
        taskId: taskId || null,
        mode: 0,
        plannedSeconds: seconds,
      });
      setSessionId(session.id);
      saveSnapshot({ sessionId: session.id, accumulated: 0, status: 'running' });
    } catch {
      /* 建会话失败仍允许本地计时 */
    }
  }, [cfg.focusMinutes, createSession, saveSnapshot, taskId]);

  const finishBreak = useCallback(() => {
    setAccumulated(0);
    segmentStart.current = null;
    setPhase('focus');
    setPlanned(cfg.focusMinutes * 60);
    if (cfg.autoStartNext) {
      void startFocus();
    } else {
      setStatus('idle');
    }
  }, [cfg, startFocus]);

  // 到时自动收尾
  useEffect(() => {
    if (status !== 'running' || elapsed < planned || planned <= 0) return;
    if (phase === 'focus') void finishFocus('complete');
    else finishBreak();
  }, [status, elapsed, planned, phase, finishFocus, finishBreak]);

  // 空闲时跟随配置
  useEffect(() => {
    if (status === 'idle' && phase === 'focus') setPlanned(cfg.focusMinutes * 60);
  }, [cfg.focusMinutes, status, phase]);

  /* --------------------------------- 操作 --------------------------------- */
  function handlePause() {
    if (status !== 'running') return;
    const next = accumulated + (segmentStart.current ? Math.floor((Date.now() - segmentStart.current) / 1000) : 0);
    setAccumulated(next);
    segmentStart.current = null;
    setStatus('paused');
    if (sessionId) {
      saveSnapshot({ sessionId, accumulated: next, status: 'paused' });
      patchSession.mutate({ id: sessionId, action: 'pause' });
    }
  }

  function handleResume() {
    if (status !== 'paused') return;
    segmentStart.current = Date.now();
    setStatus('running');
    if (sessionId) {
      saveSnapshot({ sessionId, accumulated, status: 'running' });
      patchSession.mutate({ id: sessionId, action: 'resume' });
    }
  }

  function handleStart() {
    if (phase === 'focus') void startFocus();
    else {
      segmentStart.current = Date.now();
      setAccumulated(0);
      setStatus('running');
    }
  }

  function handleGiveUp() {
    if (phase === 'focus') void finishFocus('cancel');
    else {
      segmentStart.current = null;
      setAccumulated(0);
      setPhase('focus');
      setPlanned(cfg.focusMinutes * 60);
      setStatus('idle');
    }
  }

  /* --------------------------------- 统计 --------------------------------- */
  const todayKey = localDateKey(new Date(), timezone);
  // 查询区间按“天”取整，保证 queryKey 在一次渲染周期内稳定（此前用 new Date().toISOString()
  // 会导致每次 tick 都换 key，缓存永远对不上，完成会话后统计看起来没刷新）。
  const statsRange = useMemo(
    () => ({
      from: startOfDay(subDays(new Date(), 6)).toISOString(),
      to: endOfDay(new Date()).toISOString(),
    }),
    [todayKey],
  );
  const { data: stats } = useFocusStats(statsRange.from, statsRange.to);

  const todaySeconds = stats?.byDay.find((d) => d.date === todayKey)?.totalSeconds ?? 0;
  const todayCount = stats?.byDay.find((d) => d.date === todayKey)?.count ?? 0;
  const weekDays = useMemo(() => {
    const map = new Map((stats?.byDay ?? []).map((d) => [d.date, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      const key = format(date, 'yyyy-MM-dd');
      return { date, key, seconds: map.get(key)?.totalSeconds ?? 0, count: map.get(key)?.count ?? 0 };
    });
  }, [stats?.byDay]);
  const maxDaySeconds = Math.max(60, ...weekDays.map((d) => d.seconds));

  /* --------------------------------- 任务 --------------------------------- */
  const { data: todayView } = useView('today', 'list');
  const todayTasks: Task[] = useMemo(() => (todayView?.groups ?? []).flatMap((g) => g.tasks), [todayView]);

  const meta = PHASE_META[phase];
  const progress = planned > 0 ? Math.min(1, elapsed / planned) : 0;

  return (
    <div className="tf-scroll h-full min-w-0 flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-brand-500" />
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">专注</h1>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="h-4 w-4" />
            {showSettings ? '收起配置' : '时长配置'}
          </Button>
        </header>

        {showSettings && (
          <FocusSettingsPanel
            cfg={cfg}
            onChange={(next) => updateSettings.mutate({ focusSettings: next })}
            loading={settingsLoading}
          />
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900">
            <RingTimer progress={progress} color={meta.ring} track={meta.track} label={meta.label} remaining={remaining} />

            <div className="mt-6 w-full max-w-xs">
              <label className="mb-1 block text-[12px] font-medium text-zinc-500">关联任务</label>
              <select
                value={taskId}
                disabled={status !== 'idle' || phase !== 'focus'}
                onChange={(e) => setTaskId(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 disabled:opacity-60 focus:border-brand-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">不关联任务</option>
                {todayTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex items-center gap-2">
              {status === 'idle' && (
                <Button variant="primary" onClick={handleStart}>
                  <Play className="h-4 w-4" />
                  {phase === 'focus' ? '开始专注' : '开始休息'}
                </Button>
              )}
              {status === 'running' && (
                <Button variant="secondary" onClick={handlePause}>
                  <Pause className="h-4 w-4" />
                  暂停
                </Button>
              )}
              {status === 'paused' && (
                <Button variant="primary" onClick={handleResume}>
                  <Play className="h-4 w-4" />
                  继续
                </Button>
              )}
              {status !== 'idle' && (
                <Button variant="ghost" onClick={handleGiveUp}>
                  <Square className="h-4 w-4" />
                  {phase === 'focus' ? '放弃' : '跳过休息'}
                </Button>
              )}
              {status !== 'idle' && phase === 'focus' && (
                <Button variant="ghost" onClick={() => void finishFocus('complete')}>
                  <RotateCcw className="h-4 w-4" />
                  完成
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">今日</h2>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatDuration(todaySeconds)}
                  </p>
                  <p className="text-[12px] text-zinc-400">总专注时长</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{todayCount}</p>
                  <p className="text-[12px] text-zinc-400">番茄数</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">近 7 天</h2>
              <div className="flex h-28 items-end gap-1.5">
                {weekDays.map((day) => (
                  <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-24 w-full items-end">
                      <div
                        title={`${formatDayLabel(day.date)} · ${formatDuration(day.seconds)}`}
                        className={cn(
                          'w-full rounded-t-md transition-all',
                          day.seconds > 0 ? 'bg-brand-400 dark:bg-brand-500' : 'bg-zinc-100 dark:bg-zinc-800',
                        )}
                        style={{ height: `${Math.max(4, Math.round((day.seconds / maxDaySeconds) * 96))}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">{day.date.getDate()}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RingTimer({
  progress,
  color,
  track,
  label,
  remaining,
}: {
  progress: number;
  color: string;
  track: string;
  label: string;
  remaining: number;
}) {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-[280px] w-[280px]">
      <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
        <circle cx="140" cy="140" r={radius} fill="none" stroke={track} strokeWidth="14" />
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.4s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-medium text-zinc-400">{label}</span>
        <span className="mt-1 text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatClock(remaining)}
        </span>
      </div>
    </div>
  );
}

function FocusSettingsPanel({
  cfg,
  onChange,
  loading,
}: {
  cfg: typeof DEFAULT_FOCUS_SETTINGS;
  onChange: (next: typeof DEFAULT_FOCUS_SETTINGS) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Spinner />
      </div>
    );
  }
  const fields: { key: keyof typeof cfg; label: string; suffix: string }[] = [
    { key: 'focusMinutes', label: '专注时长', suffix: '分钟' },
    { key: 'shortBreakMinutes', label: '短休息', suffix: '分钟' },
    { key: 'longBreakMinutes', label: '长休息', suffix: '分钟' },
    { key: 'longBreakEvery', label: '长休息间隔', suffix: '个番茄' },
  ];
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-[12px] font-medium text-zinc-500">{field.label}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={cfg[field.key] as number}
                onChange={(e) => onChange({ ...cfg, [field.key]: Math.max(1, Number(e.target.value) || 1) })}
                className="h-9 w-20 text-center"
              />
              <span className="text-[12px] text-zinc-400">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-zinc-500">快捷：</span>
          {FOCUS_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onChange({ ...cfg, focusMinutes: minutes })}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[12px] transition-colors',
                cfg.focusMinutes === minutes
                  ? 'bg-brand-500 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
              )}
            >
              {minutes} 分钟
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={cfg.autoStartNext}
            onChange={(e) => onChange({ ...cfg, autoStartNext: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-300 text-brand-500 focus:ring-brand-500"
          />
          自动开始下一段
        </label>
      </div>
    </section>
  );
}