'use client';

import { Timer } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

export default function FocusPage() {
  return (
    <ComingSoon
      icon={<Timer className="h-8 w-8" />}
      title="专注 / 番茄钟"
      description="用番茄工作法保持专注，并统计你的专注时长。"
      features={['番茄钟计时（专注 / 短休息 / 长休息）', '关联任务开始专注', '跨端恢复进行中的会话', '按日/周统计专注时长']}
    />
  );
}