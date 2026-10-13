'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function CompletedPage() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'completed' }} />;
}