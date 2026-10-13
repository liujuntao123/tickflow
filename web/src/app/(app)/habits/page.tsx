'use client';

import { ModuleGate } from '@/components/app/module-gate';
import { HabitsWorkspace } from '@/components/app/habits-view';

export default function HabitsPage() {
  return (
    <ModuleGate module="moduleHabits">
      <HabitsWorkspace />
    </ModuleGate>
  );
}