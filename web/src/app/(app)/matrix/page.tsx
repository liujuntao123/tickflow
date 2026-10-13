'use client';

import { ModuleGate } from '@/components/app/module-gate';
import { MatrixWorkspace } from '@/components/app/matrix-view';

export default function MatrixPage() {
  return (
    <ModuleGate module="moduleMatrix">
      <MatrixWorkspace />
    </ModuleGate>
  );
}