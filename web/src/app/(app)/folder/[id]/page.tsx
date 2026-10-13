'use client';

import { useParams } from 'next/navigation';
import { TaskWorkspace } from '@/components/app/task-workspace';

export default function FolderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return <TaskWorkspace source={{ kind: 'folder', id }} />;
}