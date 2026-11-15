import { create } from 'zustand';
import { DriveSim, deg, type DriveStats, type LayoutId } from './drive';

/**
 * Pololu 3pi+ 2040 的執行期狀態。
 * 3pi+ 的程式（generator）自己推進物理：每次等待時呼叫 botWait()，把模擬往前推同樣的毫秒數，
 * 所以不用改動共用的 Engine（和 Jetson 的 vision.ts 同一種做法）。
 * 3D 場景每幀讀 botVisual；面板（BotPanel）讀 useBot，每 100 毫秒更新一次。
 */
export type BotButton = 'A' | 'B' | 'C';

export interface BotTelem {
  counts: [number, number];
  line: number[];
  bump: [boolean, boolean];
  cmd: [number, number];
  /** 速度（cm/s）、機頭角度（度，0 朝右、逆時針為正） */
  v: number;
  heading: number;
  calibrated: boolean;
}

export interface BotStore {
  /** 目前程式用的場地（在面板與 3D 賽道墊顯示） */
  layout: LayoutId;
  oled: string[];
  telem: BotTelem | null;
  stats: DriveStats | null;
  /** 按鈕：按下事件（check() 取走）與目前是否按住 */
  presses: BotButton[];
  held: BotButton[];
  /** 最近一次轉彎量到的角度、最近一次編碼器量距離的結果（任務檢查用） */
  lastTurn: number | null;
  odo: { target: number; actual: number } | null;
  press: (b: BotButton) => void;
  release: (b: BotButton) => void;
  take: (b: BotButton) => boolean;
  setOled: (lines: string[]) => void;
  setLayout: (l: LayoutId) => void;
}

export const useBot = create<BotStore>((set, get) => ({
  layout: 'open',
  oled: [],
  telem: null,
  stats: null,
  presses: [],
  held: [],
  lastTurn: null,
  odo: null,
  press: (b) => set((s) => ({ presses: [...s.presses, b], held: s.held.includes(b) ? s.held : [...s.held, b] })),
  release: (b) => set((s) => ({ held: s.held.filter((x) => x !== b) })),
  take: (b) => {
    const p = get().presses;
    const i = p.indexOf(b);
    if (i < 0) return false;
    set({ presses: p.filter((_, j) => j !== i) });
    return true;
  },
  setOled: (oled) => set({ oled }),
  setLayout: (layout) => {
    if (get().layout === layout) return;
    set({ layout });
    if (!sim) placeAt(layout);
  },
}));

/** 3D 場景每幀讀取（可變物件，不觸發 React 重繪） */
export const botVisual = { x: -0.38, y: -0.12, th: 0, angL: 0, angR: 0, bumpL: false, bumpR: false, emit: false, layout: 'open' as LayoutId };

let sim: DriveSim | null = null;
let telemAt = 0;

function placeAt(layout: LayoutId) {
  const s = new DriveSim(layout);
  Object.assign(botVisual, { x: s.x, y: s.y, th: s.th, bumpL: false, bumpR: false, emit: false, layout });
}

export const botSim = () => sim;

/** 每次執行程式時：換到指定場地、把車子放回起點、清掉統計與按鈕 */
export function botStart(layout: LayoutId): DriveSim {
  sim = new DriveSim(layout);
  telemAt = 0;
  useBot.setState({ layout, oled: [], presses: [], telem: null, stats: null, lastTurn: null, odo: null });
  sync(true);
  return sim;
}

/** 程式停止時（Engine 不會通知我們，所以由面板偵測 running 變 false 時呼叫）。統計留著給任務檢查 */
export function botStop() {
  if (sim) sync(true);
  sim = null;
  // 清掉讀值：面板的按鈕 A 要等下一次程式真的開始跑（botStart）才能按
  useBot.setState({ telem: null, presses: [], held: [] });
}

function sync(force = false) {
  const s = sim;
  if (!s) return;
  Object.assign(botVisual, { x: s.x, y: s.y, th: s.th, angL: s.angL, angR: s.angR, bumpL: s.bumpL, bumpR: s.bumpR, layout: s.layout.id });
  if (!force && telemAt < 100) return;
  telemAt = 0;
  useBot.setState({
    telem: {
      counts: s.counts(),
      // 還沒校正時顯示原始讀值（約 100–1000），校正後顯示 0–1000
      line: s.calibrated ? s.readCalibrated() : s.readRaw(),
      bump: [s.bumpL, s.bumpR],
      cmd: [s.cmdL, s.cmdR],
      v: ((s.vl + s.vr) / 2) * 100,
      heading: deg(s.th),
      calibrated: s.calibrated,
    },
    stats: { ...s.stats },
  });
}

/** 推進模擬 ms 毫秒（程式在等待、或每跑完一輪控制迴圈時呼叫） */
export function botAdvance(ms: number) {
  const s = sim;
  if (!s) return;
  s.step(ms / 1000);
  telemAt += ms;
  sync();
}
