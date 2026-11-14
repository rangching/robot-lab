import { Circuit, type PinOut, type SimInputs } from './circuit';
import { ep, type Comp, type Wire } from './types';
import type { Gen, IO, ProgramDef, PinMode } from './programs';
import { simBoard } from './board';

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
}

export const freshObserved = (): Observed => ({
  runMs: 0, blinksL: 0, extLedOn: 0, pressLit: false, potMin: 1, potMax: 0, ledMin: 1, ledMax: 0,
  servoMin: 999, servoMax: -999, distReads: 0, distMin: 999, distMax: -1, tones: 0,
});

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
}

export const simVisual: SimVisual = { running: false, L: 0, TX: 0, RX: 0, led: {}, servo: {}, buzz: {}, sonar: {}, pressed: {}, pot: {}, distance: 40 };

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
    };
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
}
