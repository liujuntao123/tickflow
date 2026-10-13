import { create } from 'zustand';
import type { GroupBy } from './types';

interface UiState {
  selectedTaskId: string | null;
  detailOpen: boolean;
  groupBy: GroupBy;
  sidebarOpen: boolean;
  selectTask: (id: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  toggleDetail: () => void;
  setGroupBy: (g: GroupBy) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTaskId: null,
  detailOpen: true,
  groupBy: 'list',
  sidebarOpen: true,
  selectTask: (id) => set({ selectedTaskId: id, detailOpen: id ? true : false }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
  toggleDetail: () => set((s) => ({ detailOpen: !s.detailOpen })),
  setGroupBy: (groupBy) => set({ groupBy }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));