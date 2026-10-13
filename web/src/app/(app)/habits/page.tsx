'use client';

import { Repeat } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

export default function HabitsPage() {
  return (
    <ComingSoon
      icon={<Repeat className="h-8 w-8" />}
      title="习惯打卡"
      description="培养好习惯，记录每日坚持，查看连续打卡与完成率。"
      features={['每日打卡与补卡', '连续天数 / 最长连续记录', '完成率统计与热力图', '习惯模板库一键创建']}
    />
  );
}