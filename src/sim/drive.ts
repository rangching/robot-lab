/**
 * Pololu 3pi+ 2040 的簡化地面運動模擬（純函式／純類別，不碰 React，可以單元測試）。
 *
 * 查證自官方文件與 MicroPython 函式庫（github.com/pololu/pololu-3pi-2040-robot）：
 * - Motors.MAX_SPEED = 6000；馬達由穩定的 8 V 升壓供電，速度不隨電池電量下降
 * - 編碼器：馬達軸上 12 CPR（兩通道雙緣計數），Standard 版減速比 29.86:1 → 每轉一圈輪子約 358.3 counts
 * - Standard 版（30:1）最高速約 1.5 m/s；輪子 32 × 7 mm；機身直徑 9.7 cm
 * - 循線感測器 DN1–DN5 由左到右；read_calibrated() 每顆 0–1000（越大越黑）
 *
 * 估計值（官方沒公開，依照片與 32U4 版推估）：輪距 8.55 cm、循線感測器間距 0.95 cm、
 * 感測器在輪軸前方 3.8 cm、馬達時間常數。另外刻意讓右輪比左輪弱 2%，模擬「兩顆馬達不會完全一樣」。
 *
 * 座標：賽道墊中心為原點，x 向右、y 朝遠方（公尺）；th 是機頭方向，0 朝 +x、逆時針為正。
 */

export const BOT = {
  radius: 0.0485,
  wheelR: 0.016,
  trackW: 0.0855, // 估計：兩輪中心距離
  gear: 29.86,
  cpr: 12,
  maxCmd: 6000,
  vMax: 1.5, // m/s，Standard 30:1
  tau: 0.06, // 馬達加速的時間常數（s）
  tauBrake: 0.02, // set_speeds(0, 0) 是煞車，停得比加速快
  sensorFwd: 0.038, // 估計：循線感測器在輪軸前方的距離
  sensorDx: 0.0095, // 估計：相鄰兩顆循線感測器的間距
  lineHalf: 0.0095, // 19 mm 黑色電工膠帶
  gainL: 1,
  gainR: 0.98,
  dt: 0.002,
};
/** 輪子轉一圈的編碼器計數 */
export const COUNTS_PER_REV = BOT.cpr * BOT.gear;
/** 每公分的編碼器計數（約 35.6） */
export const COUNTS_PER_CM = COUNTS_PER_REV / (Math.PI * BOT.wheelR * 200);

export type LayoutId = 'open' | 'boxes' | 'oval' | 'wavy';
export interface Box2 { x: number; y: number; w: number; h: number }
export interface Layout {
  id: LayoutId;
  name: string;
  /** 墊子半寬、半深（m），四周有矮牆 */
  hw: number;
  hd: number;
  boxes: Box2[];
  /** 黑線（閉合路徑，取樣點） */
  path: [number, number][] | null;
  start: { x: number; y: number; th: number };
}

const MAT_HW = 0.5;
const MAT_HD = 0.35;

function sample(f: (t: number) => [number, number], n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2));
}

/** 運動場型橢圓：兩段直線＋兩個半圓 */
function stadium(t: number): [number, number] {
  const a = 0.25; // 直線半長
  const r = 0.2;
  const L = 4 * a + 2 * Math.PI * r;
  let s = (t / (Math.PI * 2)) * L;
  // 從下方直線的左端出發，往右（逆時針繞）
  if (s < 2 * a) return [-a + s, -r];
  s -= 2 * a;
  if (s < Math.PI * r) { const u = -Math.PI / 2 + s / r; return [a + r * Math.cos(u), r * Math.sin(u)]; }
  s -= Math.PI * r;
  if (s < 2 * a) return [a - s, r];
  s -= 2 * a;
  const u = Math.PI / 2 + s / r;
  return [-a + r * Math.cos(u), r * Math.sin(u)];
}

/** 彎來彎去的賽道：橢圓外加起伏，有急彎也有反向彎 */
function wavy(t: number): [number, number] {
  return [0.36 * Math.cos(t) + 0.03 * Math.cos(3 * t), 0.2 * Math.sin(t) + 0.07 * Math.sin(3 * t)];
}

function startOn(path: [number, number][], i = 0) {
  const [x, y] = path[i];
  const [x2, y2] = path[(i + 2) % path.length];
  return { x, y, th: Math.atan2(y2 - y, x2 - x) };
}

const OVAL_PATH = sample(stadium, 480);
const WAVY_PATH = sample(wavy, 600);

export const LAYOUTS: Record<LayoutId, Layout> = {
  open: { id: 'open', name: '空曠練習墊', hw: MAT_HW, hd: MAT_HD, boxes: [], path: null, start: { x: -0.38, y: -0.12, th: 0 } },
  boxes: {
    id: 'boxes', name: '障礙物場地', hw: MAT_HW, hd: MAT_HD, path: null, start: { x: -0.36, y: -0.12, th: 0 },
    boxes: [
      { x: 0.02, y: -0.08, w: 0.1, h: 0.2 },
      { x: -0.18, y: 0.2, w: 0.16, h: 0.1 },
      { x: 0.3, y: 0.16, w: 0.1, h: 0.14 },
    ],
  },
  oval: { id: 'oval', name: '橢圓循線賽道', hw: MAT_HW, hd: MAT_HD, boxes: [], path: OVAL_PATH, start: startOn(OVAL_PATH, 60) },
  wavy: { id: 'wavy', name: '彎道循線賽道', hw: MAT_HW, hd: MAT_HD, boxes: [], path: WAVY_PATH, start: startOn(WAVY_PATH, 450) },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const deg = (r: number) => (r * 180) / Math.PI;

/** 點到閉合路徑的最近距離與最近的取樣點編號 */
export function nearest(path: [number, number][], x: number, y: number) {
  let best = Infinity;
  let bi = 0;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[(i + 1) % n];
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) { best = d; bi = i; }
  }
  return { d: best, i: bi };
}

export function pathLength(path: [number, number][]) {
  let L = 0;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[(i + 1) % path.length];
    L += Math.hypot(bx - ax, by - ay);
  }
  return L;
}

export interface DriveStats {
  /** 沿著出發方向最遠前進／最遠後退（cm，後退為負） */
  maxAdvance: number;
  minAdvance: number;
  /** 里程（cm，兩輪平均的絕對值累加） */
  dist: number;
  /** 碰撞開關被按下的次數（左、右，上升緣） */
  bumpsL: number;
  bumpsR: number;
  /** 撞到東西但碰撞開關沒感覺到（側面、後面）的次數 */
  sideHits: number;
  /** 循線：完成的圈數、第一圈花的時間、脫軌次數、最快速度（m/s） */
  laps: number;
  lapMs: number;
  derails: number;
  vMax: number;
  /** 機頭和出發時差了幾度（累計，逆時針為正） */
  turn: number;
  /** 偏離黑線中心的平均絕對值（cm，只算在線上的時間） */
  wobble: number;
  timeMs: number;
}

const freshStats = (): DriveStats => ({ maxAdvance: 0, minAdvance: 0, dist: 0, bumpsL: 0, bumpsR: 0, sideHits: 0, laps: 0, lapMs: 0, derails: 0, vMax: 0, turn: 0, wobble: 0, timeMs: 0 });

export class DriveSim {
  x = 0;
  y = 0;
  th = 0;
  /** 兩輪實際線速度（m/s） */
  vl = 0;
  vr = 0;
  /** 馬達指令（−6000～6000） */
  cmdL = 0;
  cmdR = 0;
  /** 編碼器累計（浮點，讀取時取整數） */
  encL = 0;
  encR = 0;
  /** 輪子轉過的角度（畫面用） */
  angL = 0;
  angR = 0;
  bumpL = false;
  bumpR = false;
  /** 循線感測器的校正值（每顆的最小、最大原始讀值） */
  calMin = [Infinity, Infinity, Infinity, Infinity, Infinity];
  calMax = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
  stats = freshStats();
  layout: Layout;
  private rng = 7;
  private prog = 0;
  private lastIdx = -1;
  private pathLen = 0;
  private offMs = 0;
  private lapT0 = 0;
  private derailed = false;
  private wobbleSum = 0;
  private wobbleN = 0;
  private hitting = false;
  private x0 = 0;
  private y0 = 0;
  private th0 = 0;
  private thPrev = 0;

  constructor(layout: LayoutId | Layout = 'open') {
    this.layout = typeof layout === 'string' ? LAYOUTS[layout] : layout;
    this.reset();
  }

  reset(layout?: LayoutId) {
    if (layout) this.layout = LAYOUTS[layout];
    const s = this.layout.start;
    this.x = this.x0 = s.x;
    this.y = this.y0 = s.y;
    this.th = this.th0 = this.thPrev = s.th;
    this.vl = this.vr = this.cmdL = this.cmdR = 0;
    this.encL = this.encR = 0;
    this.bumpL = this.bumpR = false;
    this.calMin = this.calMin.map(() => Infinity);
    this.calMax = this.calMax.map(() => -Infinity);
    this.stats = freshStats();
    this.pathLen = this.layout.path ? pathLength(this.layout.path) : 0;
    this.prog = 0;
    this.lastIdx = this.layout.path ? nearest(this.layout.path, s.x, s.y).i : -1;
    this.offMs = 0;
    this.lapT0 = 0;
    this.derailed = false;
    this.wobbleSum = this.wobbleN = 0;
    this.hitting = false;
  }

  /** 開始計圈（校正完、真的開始循線時呼叫）：圈數、圈速從這裡算起 */
  startLap() {
    if (!this.layout.path) return;
    this.prog = 0;
    this.lastIdx = nearest(this.layout.path, this.x, this.y).i;
    this.lapT0 = this.stats.timeMs;
    this.stats.laps = 0;
    this.stats.lapMs = 0;
  }

  setSpeeds(l: number, r: number) {
    this.cmdL = clamp(Math.round(l), -BOT.maxCmd, BOT.maxCmd);
    this.cmdR = clamp(Math.round(r), -BOT.maxCmd, BOT.maxCmd);
  }

  /** 編碼器（整數，左、右）；reset 為 true 時讀完歸零 */
  counts(reset = false): [number, number] {
    const c: [number, number] = [Math.trunc(this.encL), Math.trunc(this.encR)];
    if (reset) { this.encL -= c[0]; this.encR -= c[1]; }
    return c;
  }

  private noise() {
    this.rng = (this.rng * 16807) % 2147483647;
    return this.rng / 2147483647;
  }

  /** 第 i 顆循線感測器（0＝DN1 最左）在地面上的位置 */
  sensorPos(i: number): [number, number] {
    const c = Math.cos(this.th);
    const s = Math.sin(this.th);
    const lat = (2 - i) * BOT.sensorDx; // 往左為正
    return [this.x + c * BOT.sensorFwd - s * lat, this.y + s * BOT.sensorFwd + c * lat];
  }

  /** 地面在某一點有多黑（0 白、1 黑） */
  darkness(x: number, y: number) {
    const L = this.layout;
    if (Math.abs(x) > L.hw || Math.abs(y) > L.hd) return 1; // 墊子外面是深色桌面
    if (!L.path) return 0;
    const { d } = nearest(L.path, x, y);
    const ap = 0.003; // 感測器看到的光點半徑
    return clamp((BOT.lineHalf + ap - d) / (2 * ap), 0, 1);
  }

  /** 原始讀值（模擬「放電時間」：越黑越大，約 100–1000） */
  readRaw(): number[] {
    return [0, 1, 2, 3, 4].map((i) => {
      const [sx, sy] = this.sensorPos(i);
      return Math.round(100 + 900 * this.darkness(sx, sy) + (this.noise() - 0.5) * 30);
    });
  }

  calibrate() {
    const raw = this.readRaw();
    raw.forEach((v, i) => {
      this.calMin[i] = Math.min(this.calMin[i], v);
      this.calMax[i] = Math.max(this.calMax[i], v);
    });
  }

  /** 校正後的讀值 0–1000；還沒校正（或只看過白底）的感測器回傳 0 */
  readCalibrated(): number[] {
    return this.readRaw().map((v, i) => {
      const lo = this.calMin[i];
      const hi = this.calMax[i];
      if (!(hi - lo > 200)) return 0;
      return Math.round(clamp(((v - lo) * 1000) / (hi - lo), 0, 1000));
    });
  }

  get calibrated() {
    return this.calMin.every((lo, i) => this.calMax[i] - lo > 200);
  }

  /** 前進 dt 秒 */
  step(dt: number) {
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(BOT.dt, left);
      this.sub(h);
      left -= h;
    }
  }

  private sub(h: number) {
    const st = this.stats;
    // 1. 馬達：一階延遲。指令為 0 時是煞車，停得比較快
    const tl = (this.cmdL / BOT.maxCmd) * BOT.vMax * BOT.gainL;
    const tr = (this.cmdR / BOT.maxCmd) * BOT.vMax * BOT.gainR;
    this.vl += (tl - this.vl) * Math.min(1, h / (this.cmdL === 0 ? BOT.tauBrake : BOT.tau));
    this.vr += (tr - this.vr) * Math.min(1, h / (this.cmdR === 0 ? BOT.tauBrake : BOT.tau));

    // 2. 差速驅動運動學
    const v = (this.vl + this.vr) / 2;
    const w = (this.vr - this.vl) / BOT.trackW;
    this.x += v * Math.cos(this.th) * h;
    this.y += v * Math.sin(this.th) * h;
    this.th = wrapPi(this.th + w * h);

    // 3. 碰撞：把機身推出牆和障礙物；正前方 ±80° 內的接觸才會壓到碰撞開關
    const contacts = this.collide();
    let bl = false;
    let br = false;
    let pushing = false;
    for (const [nx, ny] of contacts) {
      // n 指向機身外面的接觸點方向
      const rel = wrapPi(Math.atan2(ny, nx) - this.th);
      if (Math.abs(rel) < (80 * Math.PI) / 180) {
        if (rel > -0.17) bl = true;
        if (rel < 0.17) br = true;
      }
      if (v * (Math.cos(this.th) * nx + Math.sin(this.th) * ny) > 0) pushing = true;
    }
    if (pushing) {
      // 頂著牆：輪子打滑、馬達接近堵轉，轉速掉很多
      this.vl *= 1 - Math.min(1, h / 0.03);
      this.vr *= 1 - Math.min(1, h / 0.03);
    }
    if (bl && !this.bumpL) st.bumpsL++;
    if (br && !this.bumpR) st.bumpsR++;
    const hit = contacts.length > 0;
    if (hit && !this.hitting && !bl && !br) st.sideHits++;
    this.hitting = hit;
    this.bumpL = bl;
    this.bumpR = br;

    // 4. 編碼器、輪子角度
    const k = COUNTS_PER_REV / (2 * Math.PI * BOT.wheelR);
    this.encL += this.vl * h * k;
    this.encR += this.vr * h * k;
    this.angL += (this.vl * h) / BOT.wheelR;
    this.angR += (this.vr * h) / BOT.wheelR;

    // 5. 統計
    st.timeMs += h * 1000;
    st.dist += Math.abs(v) * h * 100;
    st.vMax = Math.max(st.vMax, Math.abs(v));
    const adv = ((this.x - this.x0) * Math.cos(this.th0) + (this.y - this.y0) * Math.sin(this.th0)) * 100;
    st.maxAdvance = Math.max(st.maxAdvance, adv);
    st.minAdvance = Math.min(st.minAdvance, adv);
    st.turn += deg(wrapPi(this.th - this.thPrev));
    this.thPrev = this.th;
    if (this.layout.path) this.trackLine(h);
  }

  /** 沿著黑線前進的進度、圈數、脫軌 */
  private trackLine(h: number) {
    const path = this.layout.path!;
    const n = path.length;
    const { d, i } = nearest(path, this.x, this.y);
    if (d < 0.04 && this.lastIdx >= 0) {
      let di = i - this.lastIdx;
      if (di > n / 2) di -= n;
      if (di < -n / 2) di += n;
      this.prog += (di / n) * this.pathLen;
      this.lastIdx = i;
      const laps = Math.floor(Math.abs(this.prog) / this.pathLen + 1e-6);
      if (laps > this.stats.laps) {
        if (this.stats.laps === 0) this.stats.lapMs = this.stats.timeMs - this.lapT0;
        this.stats.laps = laps;
      }
    }
    // 感測器陣列中心離線超過 4 cm 且持續 0.3 秒＝脫軌
    const [cx, cy] = this.sensorPos(2);
    const ds = nearest(path, cx, cy).d;
    if (ds > 0.04) {
      this.offMs += h * 1000;
      if (this.offMs > 300 && !this.derailed) { this.derailed = true; this.stats.derails++; }
    } else {
      this.offMs = 0;
      if (ds < 0.02) this.derailed = false;
      if (Math.abs(this.vl + this.vr) > 0.05) {
        this.wobbleSum += ds * 100;
        this.wobbleN++;
        this.stats.wobble = this.wobbleSum / this.wobbleN;
      }
    }
  }

  /** 回傳每個接觸點的方向（從機身中心指向接觸點的單位向量），並把機身推出去 */
  private collide(): [number, number][] {
    const R = BOT.radius;
    const L = this.layout;
    const out: [number, number][] = [];
    // 四周矮牆
    if (this.x + R > L.hw) { this.x = L.hw - R; out.push([1, 0]); }
    if (this.x - R < -L.hw) { this.x = -L.hw + R; out.push([-1, 0]); }
    if (this.y + R > L.hd) { this.y = L.hd - R; out.push([0, 1]); }
    if (this.y - R < -L.hd) { this.y = -L.hd + R; out.push([0, -1]); }
    for (const b of L.boxes) {
      const cx = clamp(this.x, b.x - b.w / 2, b.x + b.w / 2);
      const cy = clamp(this.y, b.y - b.h / 2, b.y + b.h / 2);
      const dx = cx - this.x;
      const dy = cy - this.y;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 1e-9) {
        const nx = dx / d;
        const ny = dy / d;
        this.x -= nx * (R - d);
        this.y -= ny * (R - d);
        out.push([nx, ny]);
      }
    }
    return out;
  }
}
