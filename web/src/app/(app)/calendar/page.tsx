'use client';

import { CalendarDays } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={<CalendarDays className="h-8 w-8" />}
      title="日历视图"
      description="以月/周/日视图纵览你的任务与日程安排。"
      features={['月 / 周 / 日三种视图切换', '按有效到期时间聚合任务', '拖拽调整截止时间', '重复任务展开到各发生日']}
    />
  );
}