'use client';

import { TaskWorkspace } from '@/components/app/task-workspace';

export default function InboxPage() {
  return <TaskWorkspace source={{ kind: 'smart', key: 'inbox' }} />;
}