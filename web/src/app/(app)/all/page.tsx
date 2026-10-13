'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function AllPage() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'all' }} />;
}