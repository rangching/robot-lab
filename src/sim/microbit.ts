import { create } from 'zustand';
import type { Gen } from './programs';

/**
 * BBC micro:bit V2 的執行期狀態：5×5 LED、按鈕 A／B、觸控 logo、加速度計（傾斜＋搖一搖）、
 * 光線、溫度、麥克風、指南針、喇叭、無線電（和面板上「朋友的 micro:bit」互傳）。
 * 程式（generator）直接讀寫這個 store，不用改共用的 Engine（和 3pi+ 的 bot.ts 同一種做法）。
 * 3D 場景每幀讀 mbVisual；面板（MicrobitPanel）讀 useMb。
 */

// ---------- 圖案與字型（原創 5×5 點陣） ----------
const rows = (r: string[]) => r.join('').split('').map((ch) => (ch === '#' ? 9 : ch === '+' ? 4 : 0));

export const IMAGES: Record<string, number[]> = {
  HEART: rows(['.#.#.', '#####', '#####', '.###.', '..#..']),
  HAPPY: rows(['.....', '.#.#.', '.....', '#...#', '.###.']),
  SAD: rows(['.....', '.#.#.', '.....', '.###.', '#...#']),
  ASLEEP: rows(['.....', '##.##', '.....', '.###.', '.....']),
  YES: rows(['.....', '....#', '...#.', '#.#..', '.#...']),
  NO: rows(['#...#', '.#.#.', '..#..', '.#.#.', '#...#']),
  SQUARE_SMALL: rows(['.....', '.###.', '.#.#.', '.###.', '.....']),
  ALL: Array(25).fill(9),
};

/** 把 MicroPython 的 Image("09990:99999:…") 字串轉成 25 個亮度 */
export function parseImage(s: string): number[] {
  return s.split(':').flatMap((r) => r.split('').map((d) => Number(d) || 0));
}

const FONT_ROWS: Record<string, string[]> = {
  '0': ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '..##.', '.#...', '#####'],
  '3': ['####.', '....#', '.###.', '....#', '####.'],
  '4': ['#..#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '####.'],
  '6': ['.###.', '#....', '####.', '#...#', '.###.'],
  '7': ['#####', '...#.', '..#..', '.#...', '#....'],
  '8': ['.###.', '#...#', '.###.', '#...#', '.###.'],
  '9': ['.###.', '#...#', '.####', '....#', '.###.'],
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  '?': ['.###.', '#...#', '..##.', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.###.', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '..#..', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....'],
};
export const glyph = (ch: string) => rows(FONT_ROWS[ch.toUpperCase()] ?? FONT_ROWS['?']);

/** 文字攤成一欄一欄（每欄 5 個亮度），字和字之間空一欄 */
export function textColumns(text: string): number[][] {
  const cols: number[][] = [];
  for (const ch of text) {
    const g = glyph(ch);
    for (let x = 0; x < 5; x++) cols.push([0, 1, 2, 3, 4].map((y) => g[y * 5 + x]));
    cols.push([0, 0, 0, 0, 0]);
  }
  return cols;
}

// ---------- 狀態 ----------
export type MbButton = 'A' | 'B' | 'logo';
export interface RadioMsg { from: 'me' | 'friend'; text: string; lost?: boolean }

export interface MbStats {
  shown: string[];
  scrolled: string[];
  presses: Record<MbButton, number>;
  tiltEdges: string[];
  rolls: number[];
  toggles: number;
  falseToggles: number;
  noiseMax: number;
  sent: number;
  rounds: number;
  timeouts: number;
  tempReads: number;
  lightReads: number;
  headings: number[];
  tunes: number;
}
const freshStats = (): MbStats => ({
  shown: [], scrolled: [], presses: { A: 0, B: 0, logo: 0 }, tiltEdges: [], rolls: [], toggles: 0, falseToggles: 0, noiseMax: 0,
  sent: 0, rounds: 0, timeouts: 0, tempReads: 0, lightReads: 0, headings: [], tunes: 0,
});

/** 朋友的 micro:bit 用的群組（固定） */
export const FRIEND_GROUP = 7;

export interface MbStore {
  running: boolean;
  matrix: number[];
  /** 按下事件（was_pressed 取走）與目前按住的 */
  presses: MbButton[];
  held: MbButton[];
  /** 加速度（毫 g）：x 右傾為正、y 往觀看者（金手指那邊）傾為正 */
  tilt: { x: number; y: number };
  gestures: string[];
  light: number;
  temp: number;
  noise: number;
  /** 最近一次拍手的時間（模擬時鐘，毫秒） */
  clapAt: number;
  heading: number;
  micOn: boolean;
  radioOn: boolean;
  group: number;
  log: RadioMsg[];
  friendMatrix: number[];
  stats: MbStats;
  press: (b: MbButton) => void;
  release: (b: MbButton) => void;
  setTilt: (x: number, y: number) => void;
  shake: () => void;
  clap: () => void;
  set: (p: Partial<Pick<MbStore, 'light' | 'temp' | 'noise' | 'heading'>>) => void;
}

const blank = () => Array(25).fill(0);

/** 按下過、但 is_pressed() 還沒看到的按鈕 */
const tapped = new Set<MbButton>();

export const useMb = create<MbStore>((set, get) => ({
  running: false,
  matrix: blank(),
  presses: [],
  held: [],
  tilt: { x: 0, y: 0 },
  gestures: [],
  light: 160,
  temp: 24,
  noise: 30,
  clapAt: -1e9,
  heading: 0,
  micOn: false,
  radioOn: false,
  group: 0,
  log: [],
  friendMatrix: blank(),
  stats: freshStats(),
  press: (b) => {
    const s = get();
    if (!s.running) return;
    tapped.add(b);
    set({ presses: [...s.presses, b], held: s.held.includes(b) ? s.held : [...s.held, b], stats: { ...s.stats, presses: { ...s.stats.presses, [b]: s.stats.presses[b] + 1 } } });
  },
  release: (b) => set((s) => ({ held: s.held.filter((x) => x !== b) })),
  setTilt: (x, y) => {
    const clamp = (v: number) => Math.max(-1024, Math.min(1024, Math.round(v)));
    set({ tilt: { x: clamp(x), y: clamp(y) } });
    mbVisual.tiltX = clamp(x);
    mbVisual.tiltY = clamp(y);
  },
  shake: () => {
    if (!get().running) return;
    set((s) => ({ gestures: [...s.gestures, 'shake'] }));
    mbVisual.shakeUntil = performance.now() + 450;
  },
  clap: () => set({ clapAt: clock }),
  set: (p) => set(p),
}));

/** 3D 場景每幀讀取（可變物件，不觸發 React 重繪） */
export const mbVisual = { matrix: blank(), tiltX: 0, tiltY: 0, shakeUntil: 0, mic: false };

// ---------- 模擬時鐘與無線電 ----------
let clock = 0;
let inbox: { text: string; at: number }[] = [];
let friendReply: ((msg: string) => string | null) | null = null;
let loudPrev = false;
let toneHook: (f: number) => void = () => {};

/** 面板掛上喇叭（測試環境沒有聲音） */
export function setMbToneHook(f: (freq: number) => void) {
  toneHook = f;
}

export const mb = () => useMb.getState();
export const mbClock = () => clock;

/** 每次執行程式時：清畫面、清統計、關掉無線電與麥克風 */
export function mbStart() {
  clock = 0;
  tapped.clear();
  inbox = [];
  friendReply = null;
  loudPrev = false;
  useMb.setState({ running: true, matrix: blank(), presses: [], gestures: [], micOn: false, radioOn: false, group: 0, log: [], friendMatrix: blank(), clapAt: -1e9, stats: freshStats() });
  mbVisual.matrix = blank();
  mbVisual.mic = false;
}

/** 程式停止（面板偵測 running 變 false 時呼叫）。統計留著給任務檢查 */
export function mbStop() {
  toneHook(0);
  useMb.setState({ running: false, presses: [], held: [], micOn: false });
  mbVisual.matrix = blank();
  mbVisual.mic = false;
  useMb.setState({ matrix: blank() });
}

function bump(p: Partial<MbStats>) {
  useMb.setState((s) => ({ stats: { ...s.stats, ...p } }));
}
export const stats = () => mb().stats;
export const addStat = bump;

/** time.sleep／sleep(ms)：推進模擬時鐘 */
export function* wait(ms: number, at: string): Gen {
  let left = ms;
  while (left > 0) {
    const h = Math.min(50, left);
    clock += h;
    left -= h;
    yield { at, wait: h };
  }
}

/** 執行一行程式（1 毫秒） */
export function* line(at: string, ms = 1): Gen {
  clock += ms;
  yield { at, wait: ms };
}

// ---------- display ----------
export function setMatrix(m: number[], name?: string) {
  const next = m.slice(0, 25);
  mbVisual.matrix = next;
  useMb.setState({ matrix: next });
  if (name && !stats().shown.includes(name)) bump({ shown: [...stats().shown, name] });
}
export const show = (name: keyof typeof IMAGES) => setMatrix(IMAGES[name], name);
export const showChar = (ch: string) => setMatrix(glyph(ch), `char:${ch}`);
export const clear = () => setMatrix(blank());

/** display.scroll(text)：每 150 毫秒往左移一欄 */
export function* scroll(text: string, at: string, delay = 150): Gen {
  const pad = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  const cols = [...pad, ...textColumns(text), ...pad.slice(0, 4)];
  for (let k = 0; k + 5 <= cols.length; k++) {
    const m = blank();
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) m[y * 5 + x] = cols[k + x][y];
    setMatrix(m);
    yield* wait(delay, at);
  }
  bump({ scrolled: [...stats().scrolled, text] });
}

// ---------- 按鈕與觸控 ----------
/** button_a.was_pressed()：取走一次按下事件 */
export function wasPressed(b: MbButton) {
  const p = mb().presses;
  const i = p.indexOf(b);
  if (i < 0) return false;
  useMb.setState({ presses: p.filter((_, j) => j !== i) });
  return true;
}
/**
 * is_pressed()／is_touched()：現在按著就成立。
 * 在面板上快速點一下（按下到放開不到一次迴圈）也算按著一次，免得程式還在 sleep 就錯過了。
 */
export function isPressed(b: MbButton) {
  if (mb().held.includes(b)) return true;
  return tapped.delete(b);
}

// ---------- 感測器 ----------
export function accel() {
  const { x, y } = mb().tilt;
  return { x, y, z: -Math.round(Math.sqrt(Math.max(0, 1024 * 1024 - x * x - y * y))) };
}
export function wasGesture(g: string) {
  const list = mb().gestures;
  const i = list.indexOf(g);
  if (i < 0) return false;
  useMb.setState({ gestures: list.filter((_, j) => j !== i) });
  return true;
}
export function lightLevel() {
  bump({ lightReads: stats().lightReads + 1 });
  return mb().light;
}
export function temperature() {
  bump({ tempReads: stats().tempReads + 1 });
  return Math.round(mb().temp);
}
export function heading() {
  const h = ((Math.round(mb().heading) % 360) + 360) % 360;
  bump({ headings: [...stats().headings.slice(-30), h] });
  return h;
}

/** 麥克風打開時，指示燈會亮 */
export function micOn() {
  if (!mb().micOn) useMb.setState({ micOn: true });
  mbVisual.mic = true;
}
/** 目前音量 0–255：背景噪音上下飄動，拍手的 150 毫秒內是 240 */
export function soundLevel() {
  micOn();
  const s = mb();
  if (clock - s.clapAt < 150) return 240;
  const jitter = Math.round(Math.sin(clock / 37) * 18 + Math.sin(clock / 11) * 9);
  return Math.max(0, Math.min(255, s.noise + jitter));
}
/** microphone.was_event(SoundEvent.LOUD)：音量從門檻以下跨上來的那一瞬間 */
export function wasLoud(threshold: number) {
  const lv = soundLevel();
  const loud = lv >= threshold;
  const hit = loud && !loudPrev;
  loudPrev = loud;
  const s = mb();
  if (s.noise > stats().noiseMax) bump({ noiseMax: s.noise });
  return { hit, byClap: clock - s.clapAt < 300 };
}

// ---------- 喇叭 ----------
export function* pitch(freq: number, ms: number, at: string): Gen {
  toneHook(freq);
  yield* wait(ms, at);
  toneHook(0);
}
const NOTE: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
/** music.play(["C4:4", …])：bpm 120、每拍 4 tick，一個 tick 125 毫秒 */
export function* playTune(notes: string[], at: string): Gen {
  let oct = 4;
  let dur = 4;
  for (const n of notes) {
    const [name, d] = n.split(':');
    if (d) dur = Number(d);
    const m = /^([A-GR])(#?)(\d?)$/i.exec(name);
    if (!m) continue;
    if (m[3]) oct = Number(m[3]);
    if (m[1].toUpperCase() === 'R') {
      yield* wait(dur * 125, at);
      continue;
    }
    const semi = NOTE[m[1].toUpperCase()] + (m[2] ? 1 : 0) + (oct - 4) * 12;
    yield* pitch(Math.round(440 * 2 ** (semi / 12)), dur * 125 - 15, at);
    yield* wait(15, at);
  }
  bump({ tunes: stats().tunes + 1 });
}

// ---------- 無線電 ----------
export function radioOn() {
  useMb.setState({ radioOn: true });
}
export function radioConfig(group: number) {
  useMb.setState({ group });
}
/** 朋友收到訊息時怎麼回（由程式設定，例如猜拳時回一個手勢） */
export function setFriendReply(f: (msg: string) => string | null, matrixFor?: (reply: string) => number[]) {
  friendReply = (msg) => {
    const r = f(msg);
    if (r && matrixFor) useMb.setState({ friendMatrix: matrixFor(r) });
    return r;
  };
}
const pushLog = (m: RadioMsg) => useMb.setState((s) => ({ log: [...s.log.slice(-5), m] }));

/** radio.send(text)：同群組的朋友才收得到；朋友 0.6 秒後回覆 */
export function radioSend(text: string) {
  const s = mb();
  if (!s.radioOn) return;
  bump({ sent: stats().sent + 1 });
  const heard = s.group === FRIEND_GROUP;
  pushLog({ from: 'me', text, lost: !heard });
  if (!heard || !friendReply) return;
  const reply = friendReply(text);
  if (reply) inbox.push({ text: reply, at: clock + 600 });
}
/** radio.receive()：沒有訊息時回傳 null */
export function radioReceive(): string | null {
  const i = inbox.findIndex((m) => m.at <= clock);
  if (i < 0) return null;
  const [m] = inbox.splice(i, 1);
  pushLog({ from: 'friend', text: m.text });
  return m.text;
}
