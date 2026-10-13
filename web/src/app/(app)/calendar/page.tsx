'use client';

import { ModuleGate } from '@/components/app/module-gate';
import { CalendarWorkspace } from '@/components/app/calendar-view';

export default function CalendarPage() {
  return (
    <ModuleGate module="moduleCalendar">
      <CalendarWorkspace />
    </ModuleGate>
  );
}