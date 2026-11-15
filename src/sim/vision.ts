import { create } from 'zustand';

/**
 * 模擬「CSI 相機 → GPU 物件偵測」。
 * 畫面上的相機面板決定鏡頭前有什麼（人、貓、瓶子）、在畫面哪裡、功耗模式；
 * Jetson 的 AI 程式（generator）每一張畫面呼叫 detect() 取得偵測結果，再用 frame() 回報給面板與任務檢查。
 * FPS 數字是示意值：只為了讓「功耗模式越高、推論越快」看得出差別，不是實測數據。
 */
export type VisionLabel = 'person' | 'cat' | 'bottle';
export type PowerMode = '15W' | '25W' | 'MAXN';

export const POWER_MODES: { id: PowerMode; label: string; fps: number; note: string }[] = [
  { id: '15W', label: '15W', fps: 48, note: '省電：電池供電的機器人常用' },
  { id: '25W', label: '25W', fps: 70, note: '均衡：GPU 時脈拉高' },
  { id: 'MAXN', label: 'MAXN SUPER', fps: 96, note: 'Super 模式：不設功耗上限，時脈最高' },
];
export const fpsOf = (m: PowerMode) => POWER_MODES.find((p) => p.id === m)!.fps;

export const LABEL_ZH: Record<VisionLabel, string> = { person: '人', cat: '貓', bottle: '瓶子' };
export const LABEL_ICON: Record<VisionLabel, string> = { person: '🧍', cat: '🐈', bottle: '🍾' };

/** 偵測框：cx 是畫面中心的水平位置（0＝最左、1＝最右），w、h 是佔畫面的比例 */
export interface Det { label: VisionLabel; conf: number; cx: number; w: number; h: number }

const BASE_CONF: Record<VisionLabel, number> = { person: 0.93, cat: 0.88, bottle: 0.8 };
const SIZE: Record<VisionLabel, [number, number]> = { person: [0.2, 0.8], cat: [0.26, 0.36], bottle: [0.1, 0.4] };

export interface VisionState {
  /** 鏡頭前的東西；null 代表空的 */
  target: VisionLabel | null;
  x: number;
  auto: boolean;
  mode: PowerMode;
  /** 程式已經打開相機、模型也載入完成 */
  cam: boolean;
  dets: Det[];
  fps: number;
  /** 統計（任務檢查用） */
  frames: number;
  personFrames: number;
  otherFrames: number;
  maxFps: number;
  modes: PowerMode[];
  /** 伺服機追蹤：有看到人並更新角度的畫面數、角度和人的位置相差 15° 以內的畫面數、人走過的最左／最右 */
  trackFrames: number;
  trackGood: number;
  xMin: number;
  xMax: number;
  setTarget: (t: VisionLabel | null) => void;
  setX: (x: number) => void;
  setAuto: (a: boolean) => void;
  setMode: (m: PowerMode) => void;
  open: () => void;
  /** 程式每張畫面呼叫一次：自動走動模式下讓目標往前走 ms 毫秒 */
  advance: (ms: number) => void;
  frame: (dets: Det[], fps: number) => void;
  track: (angle: number, x: number) => void;
  /** 每次執行前清掉統計（保留使用者在面板上的設定） */
  reset: () => void;
}

let phase = 0;
let uiFrame = 0;

export const useVision = create<VisionState>((set, get) => ({
  target: 'person',
  x: 0.5,
  auto: false,
  mode: '15W',
  cam: false,
  dets: [],
  fps: 0,
  frames: 0,
  personFrames: 0,
  otherFrames: 0,
  maxFps: 0,
  modes: [],
  trackFrames: 0,
  trackGood: 0,
  xMin: 1,
  xMax: 0,
  setTarget: (target) => set({ target }),
  setX: (x) => set({ x: Math.max(0, Math.min(1, x)) }),
  setAuto: (auto) => {
    // 從目前位置接著走，畫面才不會跳
    phase = Math.asin(Math.max(-1, Math.min(1, (get().x - 0.5) / 0.46)));
    set({ auto });
  },
  setMode: (mode) => set({ mode }),
  open: () => set({ cam: true }),
  advance: (ms) => {
    if (!get().auto) return;
    phase += (ms / 1000) * 0.8;
    const x = 0.5 + 0.46 * Math.sin(phase);
    set({ x });
  },
  frame: (dets, fps) => {
    const s = get();
    const person = dets.some((d) => d.label === 'person');
    const other = dets.some((d) => d.label !== 'person');
    const upd: Partial<VisionState> = {
      frames: s.frames + 1,
      personFrames: s.personFrames + (person ? 1 : 0),
      otherFrames: s.otherFrames + (other ? 1 : 0),
      maxFps: Math.max(s.maxFps, fps),
      modes: s.modes.includes(s.mode) ? s.modes : [...s.modes, s.mode],
    };
    // 面板不用每張畫面都重畫：偵測結果有變、或每 3 張更新一次
    const changed = dets.length !== s.dets.length || dets.some((d, i) => d.label !== s.dets[i]?.label);
    if (changed || ++uiFrame % 3 === 0 || s.fps !== fps) Object.assign(upd, { dets, fps });
    set(upd);
  },
  track: (angle, x) => {
    const s = get();
    set({
      trackFrames: s.trackFrames + 1,
      trackGood: s.trackGood + (Math.abs(angle - x * 180) <= 15 ? 1 : 0),
      xMin: Math.min(s.xMin, x),
      xMax: Math.max(s.xMax, x),
    });
  },
  reset: () => set({ cam: false, dets: [], fps: 0, frames: 0, personFrames: 0, otherFrames: 0, maxFps: 0, modes: [], trackFrames: 0, trackGood: 0, xMin: 1, xMax: 0 }),
}));

/**
 * 依目前鏡頭前的東西產生偵測結果。t 是程式執行的毫秒數，用來讓信心分數自然地小幅晃動；
 * 目標走到畫面邊緣、只剩半個身體時信心會下降，低於門檻 th 就偵測不到。
 */
export function detect(t: number, th: number): Det[] {
  const s = useVision.getState();
  if (!s.target) return [];
  const edge = Math.min(s.x, 1 - s.x);
  const visible = edge < 0.08 ? Math.max(0, edge / 0.08) : 1;
  const conf = (BASE_CONF[s.target] - 0.035 * (0.5 + 0.5 * Math.sin(t / 170))) * (0.3 + 0.7 * visible);
  if (conf < th) return [];
  const [w, h] = SIZE[s.target];
  return [{ label: s.target, conf, cx: s.x, w, h }];
}
