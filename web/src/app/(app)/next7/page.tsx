'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function Next7Page() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'next7' }} />;
}