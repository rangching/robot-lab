import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { levelOf } from './levels';
import { BADGES } from './badges';
import { sfx } from '../music/sfx';

/** localStorage 在私密模式或被封鎖時會丟例外，全部包起來 */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* 忽略 */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { /* 忽略 */ }
  },
};

export interface Settings {
  track: string;
  volume: number;
  musicOn: boolean;
  sfxOn: boolean;
  nudged: boolean;
}

export interface ProgressState {
  xp: number;
  awarded: Record<string, number>;
  badges: Record<string, string>;
  streak: { last: string; days: number };
  lessonRead: string[];
  quizBest: number;
  assemblyDone: boolean;
  missionSteps: Record<string, number>;
  missionsDone: string[];
  shorts: number;
  settings: Settings;
  award: (key: string, xp: number, label: string) => void;
  grantBadge: (id: string) => void;
  touchStreak: () => void;
  markLesson: (id: string) => void;
  setQuizBest: (n: number) => void;
  setAssemblyDone: () => void;
  setMissionStep: (mission: string, n: number) => void;
  completeMission: (mission: string) => void;
  addShort: () => void;
  setSettings: (s: Partial<Settings>) => void;
  resetAll: () => void;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function dayDiff(a: string, b: string) {
  const pa = Date.parse(a + 'T00:00:00');
  const pb = Date.parse(b + 'T00:00:00');
  return Math.round((pb - pa) / 86400000);
}

// ---------- 非持久化的 UI 狀態：通知與升級畫面 ----------
export interface Toast { id: number; text: string; xp?: number; kind: 'xp' | 'badge' | 'info' }
interface UiState {
  toasts: Toast[];
  levelUp: { level: number; name: string } | null;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  closeLevelUp: () => void;
  showLevelUp: (level: number, name: string) => void;
}
let tid = 0;
export const useUi = create<UiState>((set) => ({
  toasts: [],
  levelUp: null,
  pushToast: (t) => {
    const id = ++tid;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200);
  },
  closeLevelUp: () => set({ levelUp: null }),
  showLevelUp: (level, name) => set({ levelUp: { level, name } }),
}));

const initial = {
  xp: 0,
  awarded: {} as Record<string, number>,
  badges: {} as Record<string, string>,
  streak: { last: '', days: 0 },
  lessonRead: [] as string[],
  quizBest: 0,
  assemblyDone: false,
  missionSteps: {} as Record<string, number>,
  missionsDone: [] as string[],
  shorts: 0,
  settings: { track: 'focus', volume: 0.45, musicOn: false, sfxOn: true, nudged: false } as Settings,
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      const addXp = (xp: number) => {
        const before = levelOf(get().xp);
        set((s) => ({ xp: s.xp + xp }));
        const after = levelOf(get().xp);
        if (after.index > before.index) {
          sfx('levelup');
          useUi.getState().showLevelUp(after.index + 1, after.name);
        }
      };
      return {
        ...initial,
        award: (key, xp, label) => {
          if (get().awarded[key] !== undefined) return;
          set((s) => ({ awarded: { ...s.awarded, [key]: xp } }));
          useUi.getState().pushToast({ text: label, xp, kind: 'xp' });
          addXp(xp);
        },
        grantBadge: (id) => {
          if (get().badges[id]) return;
          const b = BADGES.find((x) => x.id === id);
          if (!b) return;
          set((s) => ({ badges: { ...s.badges, [id]: today() } }));
          sfx('badge');
          useUi.getState().pushToast({ text: `獲得徽章「${b.name}」`, xp: b.xp, kind: 'badge' });
          addXp(b.xp);
        },
        touchStreak: () => {
          const t = today();
          const { last, days } = get().streak;
          if (last === t) return;
          const next = last && dayDiff(last, t) === 1 ? days + 1 : 1;
          set({ streak: { last: t, days: next } });
          if (next >= 3) get().grantBadge('streak3');
          if (next >= 7) get().grantBadge('streak7');
        },
        markLesson: (id) => {
          if (get().lessonRead.includes(id)) return;
          set((s) => ({ lessonRead: [...s.lessonRead, id] }));
        },
        setQuizBest: (n) => set((s) => ({ quizBest: Math.max(s.quizBest, n) })),
        setAssemblyDone: () => set({ assemblyDone: true }),
        setMissionStep: (m, n) => set((s) => ({ missionSteps: { ...s.missionSteps, [m]: Math.max(s.missionSteps[m] ?? 0, n) } })),
        completeMission: (m) => {
          if (get().missionsDone.includes(m)) return;
          set((s) => ({ missionsDone: [...s.missionsDone, m] }));
        },
        addShort: () => set((s) => ({ shorts: s.shorts + 1 })),
        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        resetAll: () => set({ ...initial, settings: get().settings }),
      };
    },
    {
      name: 'robot-lab-progress-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { award, grantBadge, touchStreak, markLesson, setQuizBest, setAssemblyDone, setMissionStep, completeMission, addShort, setSettings, resetAll, ...rest } = s;
        return rest;
      },
    },
  ),
);
