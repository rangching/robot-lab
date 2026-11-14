import { create } from 'zustand';

export type StageMode = 'explore' | 'quiz' | 'assembly';
export type View = 'iso' | 'top' | 'bottom' | 'front';

interface LabState {
  mode: StageMode;
  selected: string | null;
  explode: number;
  labels: boolean;
  rotate: boolean;
  view: View;
  viewNonce: number;
  setMode: (m: StageMode) => void;
  select: (id: string | null) => void;
  setExplode: (v: number) => void;
  toggleLabels: () => void;
  toggleRotate: () => void;
  setView: (v: View) => void;
}

export const useLab = create<LabState>((set) => ({
  mode: 'explore',
  selected: null,
  explode: 0,
  labels: true,
  rotate: false,
  view: 'iso',
  viewNonce: 0,
  setMode: (mode) => set({ mode, selected: null, explode: 0, rotate: false }),
  select: (selected) => set({ selected }),
  setExplode: (explode) => set({ explode }),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  toggleRotate: () => set((s) => ({ rotate: !s.rotate })),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1, selected: null })),
}));

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try { history.replaceState(null, '', `#${id}`); } catch { /* 忽略 */ }
}
