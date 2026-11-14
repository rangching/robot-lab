import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { levelOf } from './levels';
import { BADGES } from './badges';
import { sfx } from '../music/sfx';
import type { BoardId } from '../../data/types';

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

/** 每塊板子各自的學習進度 */
export interface BoardProgress {
  lessonRead: string[];
  quizBest: number;
  assemblyDone: boolean;
}

export const EMPTY_BOARD: BoardProgress = { lessonRead: [], quizBest: 0, assemblyDone: false };

/** 舊版（只有 Uno）留下的 XP 與徽章 key 沒有前綴；其他板子加上「板子:」前綴，避免重複領獎 */
export const bkey = (board: BoardId, key: string) => (board === 'uno' ? key : `${board}:${key}`);

export interface ProgressState {
  xp: number;
  awarded: Record<string, number>;
  badges: Record<string, string>;
  streak: { last: string; days: number };
  /** 目前選的板子 */
  board: BoardId;
  boards: Partial<Record<BoardId, BoardProgress>>;
  missionSteps: Record<string, number>;
  missionsDone: string[];
  shorts: number;
  settings: Settings;
  award: (key: string, xp: number, label: string) => void;
  grantBadge: (id: string) => void;
  touchStreak: () => void;
  setBoard: (b: BoardId) => void;
  markLesson: (board: BoardId, id: string) => void;
  setQuizBest: (board: BoardId, n: number) => void;
  setAssemblyDone: (board: BoardId) => void;
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
  board: 'uno' as BoardId,
  boards: {} as Partial<Record<BoardId, BoardProgress>>,
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
        setBoard: (board) => set({ board }),
        markLesson: (b, id) => {
          const cur = boardProgress(get(), b);
          if (cur.lessonRead.includes(id)) return;
          set((s) => ({ boards: { ...s.boards, [b]: { ...cur, lessonRead: [...cur.lessonRead, id] } } }));
        },
        setQuizBest: (b, n) => {
          const cur = boardProgress(get(), b);
          set((s) => ({ boards: { ...s.boards, [b]: { ...cur, quizBest: Math.max(cur.quizBest, n) } } }));
        },
        setAssemblyDone: (b) => {
          const cur = boardProgress(get(), b);
          set((s) => ({ boards: { ...s.boards, [b]: { ...cur, assemblyDone: true } } }));
        },
        setMissionStep: (m, n) => set((s) => ({ missionSteps: { ...s.missionSteps, [m]: Math.max(s.missionSteps[m] ?? 0, n) } })),
        completeMission: (m) => {
          if (get().missionsDone.includes(m)) return;
          set((s) => ({ missionsDone: [...s.missionsDone, m] }));
        },
        addShort: () => set((s) => ({ shorts: s.shorts + 1 })),
        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        resetAll: () => set({ ...initial, board: get().board, settings: get().settings }),
      };
    },
    {
      name: 'robot-lab-progress-v1',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      // v1 只有 Uno：把扁平的 lessonRead／quizBest／assemblyDone 搬進 boards.uno
      migrate: (old, version) => {
        const o = (old ?? {}) as Record<string, unknown>;
        if (version < 2) {
          const { lessonRead, quizBest, assemblyDone, ...rest } = o;
          return {
            ...rest,
            board: 'uno',
            boards: { uno: { lessonRead: (lessonRead as string[]) ?? [], quizBest: (quizBest as number) ?? 0, assemblyDone: !!assemblyDone } },
          } as unknown as ProgressState;
        }
        return o as unknown as ProgressState;
      },
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { award, grantBadge, touchStreak, setBoard, markLesson, setQuizBest, setAssemblyDone, setMissionStep, completeMission, addShort, setSettings, resetAll, ...rest } = s;
        return rest;
      },
    },
  ),
);

export function boardProgress(s: Pick<ProgressState, 'boards'>, b: BoardId): BoardProgress {
  return s.boards[b] ?? EMPTY_BOARD;
}

/** 目前板子的進度（React hook） */
export function useBoardProgress(): BoardProgress & { board: BoardId } {
  const board = useProgress((s) => s.board);
  const bp = useProgress((s) => s.boards[board]) ?? EMPTY_BOARD;
  return { ...bp, board };
}
