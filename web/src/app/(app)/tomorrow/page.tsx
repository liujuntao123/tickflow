'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function TomorrowPage() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'tomorrow' }} />;
}