/**
 * M5Stamp Fly 的簡化飛行物理＋飛控（純函式／純類別，不碰 React，可以單元測試）。
 *
 * 參考官方開源韌體（github.com/m5stack/M5StampFly 的 src/flight_control.cpp）：
 * - 馬達 GPIO：左前 FL＝5、右前 FR＝42、左後 RL＝10、右後 RR＝41（LEDC 150 kHz、8 位元）
 * - 控制迴圈 400 Hz（Control_period = 0.0025 s）
 * - 混控：FR = T + (−R + P + Y)/4、FL = T + (R + P − Y)/4、RR = T + (−R − P − Y)/4、RL = T + (R − P + Y)/4
 *   → 對角的兩顆（FR＋RL、FL＋RR）同一個轉向，這是 X 型四軸抵消反扭力的關鍵。
 *
 * 座標與符號：roll 正＝右側往下、pitch 正＝機頭抬起、yaw 正＝從上往下看順時針轉。
 * 物理量用 SI（公尺、公斤、秒）；高度 z 是離地高度。
 */

export const MOTORS = ['FL', 'FR', 'RL', 'RR'] as const;
export type MotorId = (typeof MOTORS)[number];
export type PropDir = 'cw' | 'ccw';
export type PropState = 'ok' | 'wrong' | null;

export const MOTOR_GPIO: Record<MotorId, string> = { FL: 'GPIO5', FR: 'GPIO42', RL: 'GPIO10', RR: 'GPIO41' };
/** 工作台上「馬達軸」的端點 id（把螺旋槳接上去＝裝槳） */
export const MOTOR_SHAFT: Record<MotorId, string> = { FL: 'MFL', FR: 'MFR', RL: 'MRL', RR: 'MRR' };
export const MOTOR_NAME: Record<MotorId, string> = { FL: '左前（FL）', FR: '右前（FR）', RL: '左後（RL）', RR: '右後（RR）' };
/** 從上往下看的馬達轉向：右前、左後逆時針；左前、右後順時針（由韌體混控的偏航符號推得） */
export const MOTOR_DIR: Record<MotorId, PropDir> = { FL: 'cw', FR: 'ccw', RL: 'ccw', RR: 'cw' };
const SPIN: Record<MotorId, number> = { FL: -1, FR: 1, RL: 1, RR: -1 };
const LEFT: Record<MotorId, number> = { FL: 1, FR: -1, RL: 1, RR: -1 };
const FRONT: Record<MotorId, number> = { FL: 1, FR: 1, RL: -1, RR: -1 };

export const PHYS = {
  mass: 0.0368, // kg（含 300 mAh 電池，官方規格 36.8 g）
  g: 9.81,
  arm: 0.0255, // 馬達中心到機身中心線的距離（m）
  fMax: 0.2, // 單顆馬達、滿電時的最大推力（N），推重比約 2.2
  qMax: 0.002, // 單顆馬達的最大反扭力（N·m）
  tau: 0.03, // 馬達轉速的時間常數（s）
  ixx: 1.6e-5,
  iyy: 1.6e-5,
  izz: 3.0e-5,
  rotDamp: 2e-5, // 空氣對轉動的阻尼
  vDrag: 0.05, // 垂直方向的空氣阻力（N per m/s）
  tether: 0.6, // 綁繩長度（m）：測試架最多讓它飛到這麼高
  flipDeg: 75, // 傾斜超過這個角度就算翻覆，韌體會切斷馬達
  dt: 0.0025, // 400 Hz
  capacityAh: 0.3,
};

/** 韌體裡寫死的懸停油門猜測值（滿電 4.2 V 附近校正）。電池電壓一掉，光靠 P 就會停在目標下方 */
export const HOVER_TRIM = 0.62;

export interface Stick { thr: number; roll: number; pitch: number; yaw: number }
export const NO_STICK: Stick = { thr: 0, roll: 0, pitch: 0, yaw: 0 };

export type FlyMode = 'direct' | 'stab' | 'alt';

export interface FlyConfig {
  mode: FlyMode;
  /** 高度 PID（單位：油門 duty／公尺） */
  kp: number;
  ki: number;
  kd: number;
  /** 目標高度（m） */
  altRef: number;
}

export interface Hardware {
  props: Record<MotorId, PropState>;
  battery: boolean;
  /** 電池剩餘電量 0–1（預設 0.6，開路約 3.92 V） */
  soc?: number;
}

export interface FlyState {
  z: number;
  vz: number;
  roll: number;
  pitch: number;
  yaw: number;
  p: number;
  q: number;
  r: number;
  /** 正規化轉速 0–1 */
  w: Record<MotorId, number>;
  duty: Record<MotorId, number>;
  vbat: number;
  soc: number;
  current: number;
  onGround: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

/** 依剩餘電量估算開路電壓（1S 高壓鋰電，4.35 V 滿電） */
export const ocv = (soc: number) => 3.5 + 0.85 * clamp(soc, 0, 1);

export class FlightSim {
  cfg: FlyConfig = { mode: 'direct', kp: 0.5, ki: 0, kd: 0.25, altRef: 0.5 };
  armed = false;
  flipped = false;
  /** 降落中：目標高度慢慢降到 0 再自動上鎖 */
  landing = false;
  s: FlyState;
  /** 自動起飛時目標高度從 0 慢慢升到設定值 */
  private ref = 0;
  private iErr = 0;
  private rng = 1;
  private hand = { roll: 0, pitch: 0 };

  constructor(public hw: Hardware) {
    const soc = hw.soc ?? 0.6;
    this.s = {
      z: 0, vz: 0, roll: 0, pitch: 0, yaw: 0, p: 0, q: 0, r: 0,
      w: { FL: 0, FR: 0, RL: 0, RR: 0 },
      duty: { FL: 0, FR: 0, RL: 0, RR: 0 },
      vbat: hw.battery ? ocv(soc) : 0,
      soc,
      current: 0,
      onGround: true,
    };
  }

  setup(cfg: Partial<FlyConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  /** 解鎖。回傳 null 代表成功，否則是拒絕的原因（照韌體的安全檢查精神） */
  arm(stick: Stick): string | null {
    if (this.armed) return null;
    if (!this.hw.battery) return '沒接電池：USB 只夠 ESP32 用，推不動馬達';
    if (this.flipped) return '機身翻覆過，先上鎖、重新執行再試';
    if (this.cfg.mode === 'direct') return '這支程式沒有飛控，不能解鎖';
    if (stick.thr > 0.05) return '油門沒有歸零！解鎖瞬間馬達會全力衝出去';
    if (Math.abs(deg(this.s.roll)) > 8 || Math.abs(deg(this.s.pitch)) > 8) return '機身不水平，IMU 的姿態還沒穩定';
    if (this.s.vbat < 3.4) return '電池電壓太低（< 3.4 V），先充電';
    this.armed = true;
    this.landing = false;
    this.ref = 0;
    this.iErr = 0;
    return null;
  }

  /** 上鎖。定高模式在空中時改成自動降落，落地才真的停 */
  disarm() {
    if (this.armed && this.cfg.mode === 'alt' && !this.s.onGround) {
      this.landing = true;
      return;
    }
    this.armed = false;
    this.landing = false;
  }

  /** 高度感測（ToF 往下量）：真實高度＋一點雜訊 */
  tof() {
    return Math.max(0, this.s.z + (this.noise() - 0.5) * 0.004);
  }

  private noise() {
    this.rng = (this.rng * 16807) % 2147483647;
    return this.rng / 2147483647;
  }

  /** 前進 dt 秒；direct 是程式直接寫進馬達腳的 duty（0–1），stick 是遙控器 */
  step(dt: number, direct: Record<MotorId, number>, stick: Stick) {
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(PHYS.dt, left);
      this.sub(h, direct, stick);
      left -= h;
    }
  }

  private controller(h: number, stick: Stick): Record<MotorId, number> {
    const s = this.s;
    let T: number;
    if (this.cfg.mode === 'alt') {
      const target = this.landing ? 0 : this.cfg.altRef;
      // 自動起飛／降落：目標高度每秒最多變 0.3 m
      this.ref += clamp(target - this.ref, -0.3 * h, 0.3 * h);
      if (this.landing && this.ref <= 0.01 && s.z < 0.03) {
        this.armed = false;
        this.landing = false;
        return { FL: 0, FR: 0, RL: 0, RR: 0 };
      }
      const e = this.ref - this.tof();
      this.iErr = clamp(this.iErr + e * h, -0.6, 0.6);
      T = HOVER_TRIM + this.cfg.kp * e + this.cfg.ki * this.iErr - this.cfg.kd * s.vz;
      T = clamp(T, 0.25, 0.9);
    } else {
      T = clamp(stick.thr, 0, 1) * 0.95;
    }
    // 角度環（P）→ 角速度環（P＋一點點 D 由角速度本身提供）
    const rollRef = rad(25) * clamp(stick.roll, -1, 1);
    const pitchRef = rad(25) * clamp(stick.pitch, -1, 1);
    const pRef = 5 * (rollRef - s.roll);
    const qRef = 5 * (pitchRef - s.pitch);
    const rRef = rad(120) * clamp(stick.yaw, -1, 1);
    const R = 0.04 * (pRef - s.p);
    const P = 0.04 * (qRef - s.q);
    const Y = 0.2 * (rRef - s.r);
    // 油門太低時不做姿態修正，避免在地上亂抽
    const k = T < 0.08 ? 0 : 1;
    const out = {
      FR: T + k * (-R + P + Y) * 0.25,
      FL: T + k * (R + P - Y) * 0.25,
      RR: T + k * (-R - P - Y) * 0.25,
      RL: T + k * (R - P + Y) * 0.25,
    };
    for (const m of MOTORS) out[m] = T < 0.02 ? 0 : clamp(out[m], 0, 0.95);
    return out;
  }

  private sub(h: number, direct: Record<MotorId, number>, stick: Stick) {
    const s = this.s;
    const P = PHYS;
    // 1. 馬達指令
    let duty: Record<MotorId, number>;
    if (this.flipped || !this.hw.battery) duty = { FL: 0, FR: 0, RL: 0, RR: 0 };
    else if (this.cfg.mode === 'direct') duty = { ...direct };
    else if (this.armed) duty = this.controller(h, stick);
    else duty = { FL: 0, FR: 0, RL: 0, RR: 0 };
    s.duty = duty;

    // 2. 電池：開路電壓 − 內阻壓降
    const load = MOTORS.reduce((a, m) => a + duty[m] * duty[m], 0);
    s.current = this.hw.battery ? load * 1.6 : 0; // 四顆全速約 6 A
    if (this.hw.battery) {
      s.soc = Math.max(0, s.soc - (s.current * h) / 3600 / P.capacityAh);
      s.vbat = ocv(s.soc) - 0.06 * s.current;
    }
    const vScale = this.hw.battery ? s.vbat / 4.2 : 0;

    // 3. 馬達轉速（一階延遲）與推力、反扭力
    let Fz = 0;
    let Mx = 0;
    let My = 0;
    let Mz = 0;
    for (const m of MOTORS) {
      const target = clamp(duty[m] * vScale, 0, 1);
      s.w[m] += (target - s.w[m]) * (h / P.tau);
      const w2 = s.w[m] * s.w[m];
      const prop = this.hw.props[m];
      // 槳裝反：把空氣往上吹，推力變成微弱的向下
      const F = prop === 'ok' ? P.fMax * w2 : prop === 'wrong' ? -0.3 * P.fMax * w2 : 0;
      const Q = prop ? P.qMax * w2 : 0.05 * P.qMax * w2;
      Fz += F;
      Mx += LEFT[m] * P.arm * F;
      My += FRONT[m] * P.arm * F;
      Mz += SPIN[m] * Q;
    }

    // 4. 姿態：在地上、推力不到重量一半時，機身被地面撐住（或被手傾斜）
    const weight = P.mass * P.g;
    const free = !s.onGround || Fz > 0.5 * weight;
    if (!free) {
      const target = this.armed ? { roll: 0, pitch: 0 } : { roll: rad(30) * clamp(stick.roll, -1, 1), pitch: rad(30) * clamp(stick.pitch, -1, 1) };
      if (this.cfg.mode !== 'direct' || !this.armed) this.hand = target;
      const kk = Math.min(1, h * 8);
      s.roll += (this.hand.roll - s.roll) * kk;
      s.pitch += (this.hand.pitch - s.pitch) * kk;
      s.p = 0;
      s.q = 0;
      s.r += (Mz / P.izz - s.r * 20) * h;
    } else {
      // 小小的亂流
      const dist = (this.noise() - 0.5) * 2e-5;
      s.p += ((Mx + dist - P.rotDamp * s.p * 2) / P.ixx) * h;
      s.q += ((My - dist - P.rotDamp * s.q * 2) / P.iyy) * h;
      s.r += ((Mz - P.rotDamp * s.r * 10) / P.izz) * h;
      s.roll += s.p * h;
      s.pitch += s.q * h;
    }
    s.yaw += s.r * h;
    if (s.yaw > Math.PI) s.yaw -= 2 * Math.PI;
    if (s.yaw < -Math.PI) s.yaw += 2 * Math.PI;

    // 5. 垂直方向：推力在機身傾斜時只剩 cos 分量
    const tilt = Math.cos(s.roll) * Math.cos(s.pitch);
    const az = (Fz * tilt - weight - P.vDrag * s.vz) / P.mass;
    s.vz += az * h;
    s.z += s.vz * h;
    if (s.z <= 0) {
      s.z = 0;
      if (s.vz < 0) s.vz = 0;
      s.onGround = true;
    } else {
      s.onGround = false;
    }
    if (s.z >= P.tether) {
      s.z = P.tether;
      if (s.vz > 0) s.vz = 0;
    }

    // 6. 翻覆保護
    if (Math.abs(deg(s.roll)) > P.flipDeg || Math.abs(deg(s.pitch)) > P.flipDeg) {
      if (!this.flipped) {
        this.flipped = true;
        this.armed = false;
        this.landing = false;
      }
    }
    if (this.flipped) {
      // 摔回測試架上，側躺
      s.roll = clamp(s.roll, -rad(100), rad(100));
      s.pitch = clamp(s.pitch, -rad(100), rad(100));
      s.p *= 0.9;
      s.q *= 0.9;
    }
  }

  /** 定高模式下目前的目標高度（含自動起飛的爬升） */
  get altTarget() {
    return this.cfg.mode === 'alt' ? this.ref : 0;
  }
}
