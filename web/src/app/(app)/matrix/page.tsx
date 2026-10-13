'use client';

import { LayoutGrid } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

export default function MatrixPage() {
  return (
    <ComingSoon
      icon={<LayoutGrid className="h-8 w-8" />}
      title="四象限"
      description="按重要 / 紧急两个维度组织任务，聚焦真正重要的事。"
      features={['重要且紧急 / 重要不紧急 / 紧急不重要 / 其余', '拖拽在象限间移动任务', '一键调整优先级与截止时间', '与智能清单计数联动']}
    />
  );
}