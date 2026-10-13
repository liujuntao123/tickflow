'use client';

import { Repeat } from 'lucide-react';
import {
  FREQ_LABELS,
  WEEKDAY_CODES,
  WEEKDAY_LABELS,
  buildRRule,
  describeRepeat,
  type RepeatConfig,
  type RepeatFreq,
} from '@/lib/rrule';
import { cn } from '@/lib/utils';
import { Dropdown, Input } from '@/components/ui';

const FREQS: RepeatFreq[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const UNIT: Record<RepeatFreq, string> = { NONE: '', DAILY: '天', WEEKLY: '周', MONTHLY: '月', YEARLY: '年' };

function Radio({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
        checked
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
      )}
    >
      <span
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-brand-500' : 'border-zinc-300 dark:border-zinc-600',
        )}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
      </span>
      {children}
    </button>
  );
}

export function RepeatPicker({ value, onChange }: { value: RepeatConfig; onChange: (cfg: RepeatConfig) => void }) {
  const cfg = value;
  const patch = (p: Partial<RepeatConfig>) => onChange({ ...cfg, ...p });

  const summary = cfg.freq === 'NONE' ? null : describeRepeat(buildRRule(cfg));

  return (
    <Dropdown
      align="start"
      panelClassName="w-[19rem] p-3"
      trigger={
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors',
            cfg.freq === 'NONE'
              ? 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800'
              : 'border-brand-200 bg-brand-50/60 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300',
          )}
        >
          <Repeat className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{summary ?? '不重复'}</span>
        </button>
      }
    >
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-1">
          {FREQS.map((f) => (
            <Radio key={f} checked={cfg.freq === f} onClick={() => patch({ freq: f })}>
              {FREQ_LABELS[f]}
            </Radio>
          ))}
        </div>

        {cfg.freq !== 'NONE' && (
          <>
            <div className="flex items-center gap-2 border-t border-zinc-100 pt-2.5 text-[13px] text-zinc-500 dark:border-zinc-800">
              <span>间隔</span>
              <Input
                type="number"
                min={1}
                max={99}
                value={cfg.interval}
                onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
                className="h-7 w-16 px-2 text-center"
              />
              <span>{UNIT[cfg.freq]}</span>
            </div>

            {cfg.freq === 'WEEKLY' && (
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_CODES.map((code) => {
                  const active = cfg.byDay.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        patch({ byDay: active ? cfg.byDay.filter((d) => d !== code) : [...cfg.byDay, code] })
                      }
                      className={cn(
                        'h-7 w-9 rounded-lg text-[12px] transition-colors',
                        active
                          ? 'bg-brand-500 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                      )}
                    >
                      {WEEKDAY_LABELS[code].replace('周', '')}
                    </button>
                  );
                })}
              </div>
            )}

            {cfg.freq === 'MONTHLY' && (
              <div className="flex items-center gap-2 text-[13px] text-zinc-500">
                <span>每月第</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={cfg.byMonthDay ?? new Date().getDate()}
                  onChange={(e) => patch({ byMonthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                  className="h-7 w-16 px-2 text-center"
                />
                <span>日</span>
              </div>
            )}

            <div className="space-y-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">结束条件</div>
              <Radio checked={cfg.end === 'never'} onClick={() => patch({ end: 'never' })}>
                永不
              </Radio>
              <Radio checked={cfg.end === 'until'} onClick={() => patch({ end: 'until' })}>
                <span className="flex items-center gap-2">
                  截止日期
                  {cfg.end === 'until' && (
                    <Input
                      type="date"
                      value={cfg.until ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patch({ until: e.target.value || null })}
                      className="h-7 w-36 px-2"
                    />
                  )}
                </span>
              </Radio>
              <Radio checked={cfg.end === 'count'} onClick={() => patch({ end: 'count' })}>
                <span className="flex items-center gap-2">
                  共
                  {cfg.end === 'count' && (
                    <>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={cfg.count ?? 10}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => patch({ count: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-7 w-16 px-2 text-center"
                      />
                      次
                    </>
                  )}
                </span>
              </Radio>
            </div>

            <div className="space-y-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">重复依据</div>
              <Radio checked={cfg.repeatFrom === 0} onClick={() => patch({ repeatFrom: 0 })}>
                按截止日
              </Radio>
              <Radio checked={cfg.repeatFrom === 1} onClick={() => patch({ repeatFrom: 1 })}>
                按完成日
              </Radio>
            </div>
          </>
        )}
      </div>
    </Dropdown>
  );
}