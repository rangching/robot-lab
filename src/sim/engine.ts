import { Circuit, type PinOut, type SimInputs } from './circuit';
import { ep, type Comp, type Wire } from './types';
import type { Gen, IO, ProgramDef, PinMode } from './programs';
import { simBoard } from './board';
import { FlightSim, MOTORS, MOTOR_GPIO, deg, type MotorId } from './flight';
import { droneHardware, useDrone } from './drone';

export interface Observed {
  runMs: number;
  blinksL: number;
  extLedOn: number;
  pressLit: boolean;
  potMin: number;
  potMax: number;
  ledMin: number;
  ledMax: number;
  servoMin: number;
  servoMax: number;
  distReads: number;
  distMin: number;
  distMax: number;
  tones: number;
  /** 無人機：轉過的馬達、解鎖成功／被拒絕次數、上鎖次數 */
  motorsSpun: string[];
  arms: number;
  armRefused: number;
  disarms: number;
  /** 無人機：最高離地高度（cm）、翻覆次數、IMU 讀取次數、手動傾斜的最大角度（度） */
  altMax: number;
  flipped: number;
  imuReads: number;
  tiltMax: number;
  /** 定高模式：在空中的時間、在目標 ±3 cm 內的時間、停在目標下方 5–40 cm 的時間（毫秒） */
  holdMs: number;
  hoverMs: number;
  lowHoverMs: number;
  maxThr: number;
}

export const freshObserved = (): Observed => ({
  runMs: 0, blinksL: 0, extLedOn: 0, pressLit: false, potMin: 1, potMax: 0, ledMin: 1, ledMax: 0,
  servoMin: 999, servoMax: -999, distReads: 0, distMin: 999, distMax: -1, tones: 0,
  motorsSpun: [], arms: 0, armRefused: 0, disarms: 0, altMax: 0, flipped: 0, imuReads: 0, tiltMax: 0,
  holdMs: 0, hoverMs: 0, lowHoverMs: 0, maxThr: 0,
});

/** 無人機的畫面狀態（高度 m、姿態 rad、四顆馬達轉速 0–1） */
export interface DroneVisual {
  alt: number;
  roll: number;
  pitch: number;
  yaw: number;
  w: Record<MotorId, number>;
  armed: boolean;
  flipped: boolean;
}

/** 給 3D 場景每幀讀取的畫面狀態（可變物件，不觸發 React 重繪） */
export interface SimVisual {
  running: boolean;
  L: number;
  TX: number;
  RX: number;
  led: Record<string, number>;
  servo: Record<string, { angle: number; ok: boolean; jitter: boolean }>;
  buzz: Record<string, number>;
  sonar: Record<string, number>;
  pressed: Record<string, boolean>;
  pot: Record<string, number>;
  distance: number;
  drone: DroneVisual | null;
}

export const simVisual: SimVisual = { running: false, L: 0, TX: 0, RX: 0, led: {}, servo: {}, buzz: {}, sonar: {}, pressed: {}, pot: {}, distance: 40, drone: null };

export const UPLOAD_MS = 900;

export class Engine {
  circuit: Circuit;
  outs: Record<string, PinOut> = {};
  gen: Gen;
  now = 0;
  waitUntil = 0;
  tag: string | null = null;
  uploadLeft = UPLOAD_MS;
  servoTarget: Record<string, number> = {};
  servoAngle: Record<string, number> = {};
  tones: Record<string, number> = {};
  obs = freshObserved();
  /** 無人機飛行模擬（只有 Stamp Fly 才有） */
  fly: FlightSim | null = null;
  private telemAt = 0;
  private prevL = 0;
  private prevLed: Record<string, number> = {};

  constructor(
    public comps: Comp[],
    wires: Wire[],
    program: ProgramDef,
    params: Record<string, number>,
    public inputs: () => SimInputs,
    public hooks: { serial: (line: string) => void; tone: (freq: number) => void },
  ) {
    this.circuit = new Circuit(comps, wires);
    for (const c of comps) if (c.type === 'servo') this.servoAngle[c.id] = 90;
    if (simBoard().id === 'stampfly') {
      this.fly = new FlightSim(droneHardware(comps, this.circuit.nets(new Set())));
      useDrone.getState().clearRun();
    }
    this.gen = program.run(this.io(), params);
  }

  private io(): IO {
    const self = this;
    return {
      pinMode(pin: string, mode: PinMode) {
        self.outs[pin] = { mode, level: self.outs[pin]?.level ?? 0 };
      },
      digitalWrite(pin, v) {
        const o = self.outs[pin] ?? { mode: 'OUTPUT', level: 0 };
        self.outs[pin] = { ...o, level: v };
      },
      analogWrite(pin, v) {
        self.outs[pin] = { mode: 'OUTPUT', level: Math.max(0, Math.min(255, v)) / 255 };
      },
      digitalRead(pin) {
        return self.circuit.digitalRead(pin, self.outs, self.inputs());
      },
      analogRead(pin) {
        const inp = self.inputs();
        const val = self.circuit.analogRead(pin, self.outs, inp);
        // 記錄使用者轉動的範圍
        for (const c of self.comps) {
          if (c.type === 'pot' && self.circuit.mcuPinOf(ep(c.id, 'W'), inp) === pin) {
            const p = inp.pot[c.id] ?? 0.5;
            self.obs.potMin = Math.min(self.obs.potMin, p);
            self.obs.potMax = Math.max(self.obs.potMax, p);
          }
        }
        return val;
      },
      servoAttach(pin) {
        self.outs[pin] = { mode: 'OUTPUT', level: 0 };
      },
      servoWrite(pin, angle) {
        self.servoTarget[pin] = angle;
      },
      pulseIn(pin, trig) {
        const inp = self.inputs();
        for (const c of self.comps) {
          if (c.type !== 'hcsr04') continue;
          if (self.circuit.mcuPinOf(ep(c.id, 'ECHO'), inp) !== pin) continue;
          if (self.circuit.mcuPinOf(ep(c.id, 'TRIG'), inp) !== trig) continue;
          const pw = self.circuit.powered(c, 'VCC', 'GND', self.outs, inp);
          if (!pw.ok || !pw.common) continue;
          simVisual.sonar[c.id] = performance.now();
          const d = inp.distance;
          self.obs.distReads++;
          self.obs.distMin = Math.min(self.obs.distMin, d);
          self.obs.distMax = Math.max(self.obs.distMax, d);
          return Math.round((d * 2) / 0.0343);
        }
        return 0;
      },
      tone(pin, f) {
        self.tones[pin] = f;
        self.obs.tones++;
      },
      noTone(pin) {
        self.tones[pin] = 0;
      },
      print(s) {
        simVisual.TX = 1;
        self.hooks.serial(s);
      },
      drone: {
        setup(cfg) {
          self.fly?.setup(cfg);
        },
        take() {
          return useDrone.getState().take();
        },
        arm(on) {
          const f = self.fly;
          if (!f) return '這塊板子沒有飛控';
          if (!on) {
            if (f.armed) self.obs.disarms++;
            f.disarm();
            return null;
          }
          const why = f.arm(useDrone.getState().stick);
          if (why) self.obs.armRefused++;
          else self.obs.arms++;
          self.refused = why;
          return why;
        },
        imu() {
          self.obs.imuReads++;
          const s = self.fly?.s;
          return { roll: s ? deg(s.roll) : 0, pitch: s ? deg(s.pitch) : 0, yaw: s ? deg(s.yaw) : 0, alt: self.fly ? self.fly.tof() * 100 : 0, vbat: s?.vbat ?? 0 };
        },
        state() {
          const f = self.fly;
          return { armed: !!f?.armed, flipped: !!f?.flipped, landing: !!f?.landing };
        },
      },
    };
  }

  private refused: string | null = null;

  /** 無人機：物理前進一步，更新觀察值、畫面與遙測 */
  private stepDrone(dt: number) {
    const f = this.fly!;
    const direct = Object.fromEntries(MOTORS.map((m) => {
      const o = this.outs[MOTOR_GPIO[m]];
      return [m, o?.mode === 'OUTPUT' ? o.level : 0];
    })) as Record<MotorId, number>;
    const stick = useDrone.getState().stick;
    f.step(dt / 1000, direct, stick);
    const s = f.s;
    const o = this.obs;
    for (const m of MOTORS) if (s.w[m] > 0.12 && !o.motorsSpun.includes(m)) o.motorsSpun = [...o.motorsSpun, m];
    if (f.armed) o.maxThr = Math.max(o.maxThr, stick.thr);
    o.altMax = Math.max(o.altMax, s.z * 100);
    if (f.flipped && o.flipped === 0) o.flipped = 1;
    if (!f.armed && s.onGround) o.tiltMax = Math.max(o.tiltMax, Math.abs(deg(s.roll)), Math.abs(deg(s.pitch)));
    if (f.armed && f.cfg.mode === 'alt' && !f.landing && s.z > 0.05) {
      o.holdMs += dt;
      // 自動起飛的爬升結束後才開始算
      if (Math.abs(f.altTarget - f.cfg.altRef) < 0.005) {
        const e = (s.z - f.cfg.altRef) * 100;
        if (Math.abs(e) <= 3) o.hoverMs += dt;
        if (e < -5 && e > -40 && Math.abs(s.vz) < 0.05) o.lowHoverMs += dt;
      }
    }
    simVisual.drone = { alt: s.z, roll: s.roll, pitch: s.pitch, yaw: s.yaw, w: { ...s.w }, armed: f.armed, flipped: f.flipped };
    this.telemAt += dt;
    if (this.telemAt >= 100) {
      this.telemAt = 0;
      useDrone.getState().setTelem(
        {
          armed: f.armed, flipped: f.flipped, landing: f.landing, mode: f.cfg.mode,
          alt: s.z * 100, ref: f.cfg.mode === 'alt' ? f.altTarget * 100 : 0, vbat: s.vbat,
          roll: deg(s.roll), pitch: deg(s.pitch), yaw: deg(s.yaw), refused: this.refused,
        },
        this.now,
      );
    }
  }

  tick(dt: number) {
    simVisual.TX = Math.max(0, simVisual.TX - dt / 60);
    simVisual.RX = Math.max(0, simVisual.RX - dt / 60);
    if (this.uploadLeft > 0) {
      this.uploadLeft -= dt;
      const ph = Math.floor(this.uploadLeft / 60) % 2;
      simVisual.TX = ph;
      simVisual.RX = 1 - ph;
      simVisual.L = Math.floor(this.uploadLeft / 120) % 2;
      return;
    }
    this.now += dt;
    this.obs.runMs += dt;
    let guard = 0;
    while (this.now >= this.waitUntil && guard++ < 600) {
      const r = this.gen.next();
      if (r.done) break;
      this.tag = r.value.at;
      this.waitUntil = Math.max(this.waitUntil, this.now - 50) + (r.value.wait ?? 1);
    }
    this.updateVisual(dt);
  }

  private updateVisual(dt: number) {
    if (this.fly) this.stepDrone(dt);
    const inp = this.inputs();
    // 板上 LED：Uno／Nano／Mega 在 D13，ESP32 在 D2
    const led = this.outs[simBoard().ledPin ?? 'D13'];
    // Blue Pill 的 PC13 LED 接在 3.3 V 和腳位之間，腳位輸出 LOW 才亮
    const L = led?.mode === 'OUTPUT' ? (simBoard().ledActiveLow ? 1 - led.level : led.level) : 0;
    if (L > 0.5 && this.prevL <= 0.5) this.obs.blinksL++;
    this.prevL = L;
    simVisual.L = L;

    const anyPressed = [...inp.pressed].length > 0;
    for (const c of this.comps) {
      if (c.type === 'led') {
        const b = this.circuit.ledBrightness(c, this.outs, inp);
        simVisual.led[c.id] = b;
        const prev = this.prevLed[c.id] ?? 0;
        if (b > 0.5 && prev <= 0.5) this.obs.extLedOn++;
        this.prevLed[c.id] = b;
        if (anyPressed && b > 0.5) this.obs.pressLit = true;
        this.obs.ledMin = Math.min(this.obs.ledMin, b);
        this.obs.ledMax = Math.max(this.obs.ledMax, b);
      } else if (c.type === 'servo') {
        const pin = this.circuit.mcuPinOf(ep(c.id, 'SIG'), inp);
        const pw = this.circuit.powered(c, 'V', 'GND', this.outs, inp);
        const target = pin != null ? this.servoTarget[pin] : undefined;
        const cur = this.servoAngle[c.id] ?? 90;
        let next = cur;
        let jitter = false;
        if (pw.ok && target !== undefined) {
          if (pw.common) {
            const step = (dt / 1000) * 500;
            next = cur + Math.max(-step, Math.min(step, target - cur));
          } else {
            jitter = true;
            next = cur + (Math.random() - 0.5) * 6;
          }
        }
        this.servoAngle[c.id] = next;
        simVisual.servo[c.id] = { angle: next, ok: pw.ok, jitter };
        if (pw.ok && pw.common && target !== undefined) {
          this.obs.servoMin = Math.min(this.obs.servoMin, next);
          this.obs.servoMax = Math.max(this.obs.servoMax, next);
        }
      } else if (c.type === 'buzzer') {
        const pin = this.circuit.mcuPinOf(ep(c.id, 'P'), inp);
        const g = this.circuit.level(ep(c.id, 'N'), this.outs, inp);
        const f = pin && g === 0 ? this.tones[pin] ?? 0 : 0;
        if ((simVisual.buzz[c.id] ?? 0) !== f) this.hooks.tone(f);
        simVisual.buzz[c.id] = f;
      }
    }
  }

  stop() {
    this.hooks.tone(0);
  }
}

export function resetVisual() {
  simVisual.running = false;
  simVisual.L = 0;
  simVisual.TX = 0;
  simVisual.RX = 0;
  simVisual.led = {};
  simVisual.servo = {};
  simVisual.buzz = {};
  simVisual.sonar = {};
  simVisual.drone = null;
}
