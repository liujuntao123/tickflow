'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function TodayPage() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'today' }} />;
}