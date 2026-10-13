'use client';

import { ModuleGate } from '@/components/app/module-gate';
import { FocusWorkspace } from '@/components/app/focus-view';

export default function FocusPage() {
  return (
    <ModuleGate module="modulePomodoro">
      <FocusWorkspace />
    </ModuleGate>
  );
}