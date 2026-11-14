/**
 * 任務程式：顯示用的 Arduino 程式碼＋對應的 JS 行為模擬（generator）。
 * 程式碼行尾的 ⟦tag⟧ 是給模擬器高亮用的標記，顯示時會被移除。
 * {{key}} 是可以在畫面上修改的參數。
 */

import type { BoardId } from '../data/types';
import { ESP32_FREE_PROGRAMS } from './programsEsp32';
import { BLUEPILL_FREE_PROGRAMS } from './programsBluepill';
import { RPI4_FREE_PROGRAMS } from './programsRpi4';
import { PICO_FREE_PROGRAMS } from './programsPico';
import { NODEMCU_FREE_PROGRAMS } from './programsNodemcu';

export type PinMode = 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT';

export interface IO {
  pinMode(pin: string, mode: PinMode): void;
  digitalWrite(pin: string, v: 0 | 1): void;
  analogWrite(pin: string, v: number): void;
  digitalRead(pin: string): 0 | 1;
  analogRead(pin: string): number;
  servoAttach(pin: string): void;
  servoWrite(pin: string, angle: number): void;
  pulseIn(pin: string, trigPin: string): number;
  tone(pin: string, freq: number): void;
  noTone(pin: string): void;
  print(s: string, newline?: boolean): void;
}

export interface Step { at: string; wait?: number }
export type Gen = Generator<Step, void, void>;

export interface ParamDef { key: string; label: string; def: number; min: number; max: number }

export interface ProgramDef {
  id: string;
  title: string;
  code: string;
  params?: ParamDef[];
  /** 會被設成 OUTPUT 的腳位，給上電前檢查用 */
  outputs: string[];
  run: (io: IO, p: Record<string, number>) => Gen;
}

const mapRange = (v: number, a: number, b: number, c: number, d: number) => Math.round(c + ((v - a) * (d - c)) / (b - a));

export const P_BLINK_L: ProgramDef = {
  id: 'blink-l',
  title: '內建 L 燈閃爍（D13）',
  outputs: ['D13'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `// L 燈內建在板子上，接在 D13
// LED_BUILTIN 就是 13 的別名
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);     // 只跑一次：設成輸出 ⟦s1⟧
  Serial.begin(9600);               // 打開序列埠 ⟦s2⟧
}

void loop() {                       // 一直重複
  digitalWrite(LED_BUILTIN, HIGH);  // 5 V：燈亮 ⟦on⟧
  Serial.println("亮"); ⟦p1⟧
  delay({{ms}});                    // 等一下 ⟦d1⟧
  digitalWrite(LED_BUILTIN, LOW);   // 0 V：燈滅 ⟦off⟧
  Serial.println("滅"); ⟦p2⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D13', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('D13', 1);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D13', 0);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_BLINK_D9: ProgramDef = {
  id: 'blink-d9',
  title: '外接 LED 閃爍（D9）',
  outputs: ['D9'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `const int LED = 9;            // LED 接在 D9

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
}

void loop() {
  digitalWrite(LED, HIGH);    // 電流：D9 → 電阻 → LED → GND ⟦on⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED, LOW); ⟦off⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D9', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('D9', 1);
      yield { at: 'on' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D9', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_BUTTON: ProgramDef = {
  id: 'button',
  title: '按鈕控制 LED（D2 → D9）',
  outputs: ['D9'],
  code: `const int BUTTON = 2;
const int LED = 9;

void setup() {
  // 內建上拉：沒按 = HIGH，按下接到 GND = LOW
  pinMode(BUTTON, INPUT_PULLUP); ⟦s1⟧
  pinMode(LED, OUTPUT); ⟦s2⟧
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {   // 按下去了？ ⟦r⟧
    digitalWrite(LED, HIGH); ⟦on⟧
  } else {
    digitalWrite(LED, LOW); ⟦off⟧
  }
}`,
  *run(io) {
    io.pinMode('D2', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('D9', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      const v = io.digitalRead('D2');
      yield { at: 'r', wait: 8 };
      if (v === 0) {
        io.digitalWrite('D9', 1);
        yield { at: 'on', wait: 8 };
      } else {
        io.digitalWrite('D9', 0);
        yield { at: 'off', wait: 8 };
      }
    }
  },
};

export const P_POT: ProgramDef = {
  id: 'pot',
  title: '可變電阻調亮度（A0 → D9 PWM）',
  outputs: ['D9'],
  code: `const int LED = 9;          // 要用有 ~ 的腳才能 PWM

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(9600); ⟦s2⟧
}

void loop() {
  int val = analogRead(A0);                // 0–5 V → 0–1023 ⟦r⟧
  int bright = map(val, 0, 1023, 0, 255);  // 換成 PWM 範圍 ⟦m⟧
  analogWrite(LED, bright);                // 亮度 0–255 ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D9', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = io.analogRead('A0');
      yield { at: 'r', wait: 4 };
      const b = mapRange(val, 0, 1023, 0, 255);
      yield { at: 'm', wait: 4 };
      io.analogWrite('D9', b);
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const P_POT_A7: ProgramDef = {
  id: 'pot-a7',
  title: '可變電阻調亮度（A7 → D3 PWM）',
  outputs: ['D3'],
  code: `const int LED = 3;          // D3 是 PWM 腳

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(9600); ⟦s2⟧
}

void loop() {
  int val = analogRead(A7);                // A7：Nano 的純類比腳 ⟦r⟧
  int bright = map(val, 0, 1023, 0, 255);  // 換成 PWM 範圍 ⟦m⟧
  analogWrite(LED, bright);                // 亮度 0–255 ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D3', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = io.analogRead('A7');
      yield { at: 'r', wait: 4 };
      const b = mapRange(val, 0, 1023, 0, 255);
      yield { at: 'm', wait: 4 };
      io.analogWrite('D3', b);
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const P_SERVO: ProgramDef = {
  id: 'servo',
  title: '伺服機來回擺動（D9）',
  outputs: ['D9'],
  params: [{ key: 'step', label: '每次轉幾度', def: 2, min: 1, max: 30 }],
  code: `#include <Servo.h>
Servo arm;

void setup() {
  arm.attach(9);                 // 訊號線接 D9 ⟦a⟧
}

void loop() {
  for (int pos = 0; pos <= 180; pos += {{step}}) { ⟦f1⟧
    arm.write(pos);              // 轉到 pos 度 ⟦w1⟧
    delay(15); ⟦d1⟧
  }
  for (int pos = 180; pos >= 0; pos -= {{step}}) { ⟦f2⟧
    arm.write(pos); ⟦w2⟧
    delay(15); ⟦d2⟧
  }
}`,
  *run(io, p) {
    io.servoAttach('D9');
    yield { at: 'a' };
    const st = Math.max(1, Math.round(p.step));
    for (;;) {
      for (let pos = 0; pos <= 180; pos += st) {
        yield { at: 'f1', wait: 1 };
        io.servoWrite('D9', pos);
        yield { at: 'w1', wait: 1 };
        yield { at: 'd1', wait: 15 };
      }
      for (let pos = 180; pos >= 0; pos -= st) {
        yield { at: 'f2', wait: 1 };
        io.servoWrite('D9', pos);
        yield { at: 'w2', wait: 1 };
        yield { at: 'd2', wait: 15 };
      }
    }
  },
};

export const P_SONAR: ProgramDef = {
  id: 'sonar',
  title: '超音波測距（TRIG D9／ECHO D10）',
  outputs: ['D9'],
  code: `const int TRIG = 9;
const int ECHO = 10;

void setup() {
  pinMode(TRIG, OUTPUT); ⟦s1⟧
  pinMode(ECHO, INPUT); ⟦s2⟧
  Serial.begin(9600); ⟦s3⟧
}

void loop() {
  digitalWrite(TRIG, HIGH);       // 送出 10 µs 的觸發脈衝 ⟦t1⟧
  delayMicroseconds(10); ⟦t2⟧
  digitalWrite(TRIG, LOW); ⟦t3⟧
  long t = pulseIn(ECHO, HIGH);   // 等回音，量時間（µs） ⟦pi⟧
  float cm = t * 0.0343 / 2;      // 音速 343 m/s，來回要除以 2 ⟦cm⟧
  Serial.print("距離：");
  Serial.print(cm);
  Serial.println(" cm"); ⟦p⟧
  delay(200); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D9', 'OUTPUT');
    yield { at: 's1' };
    io.pinMode('D10', 'INPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    for (;;) {
      io.digitalWrite('D9', 1);
      yield { at: 't1', wait: 3 };
      yield { at: 't2', wait: 3 };
      io.digitalWrite('D9', 0);
      yield { at: 't3', wait: 3 };
      const t = io.pulseIn('D10', 'D9');
      yield { at: 'pi', wait: Math.max(4, t / 1000) };
      const cm = (t * 0.0343) / 2;
      yield { at: 'cm', wait: 3 };
      io.print(t === 0 ? '距離：0.00 cm（沒有收到回音）' : `距離：${cm.toFixed(2)} cm`);
      yield { at: 'p', wait: 3 };
      yield { at: 'd', wait: 200 };
    }
  },
};

export const P_MELODY: ProgramDef = {
  id: 'melody',
  title: '蜂鳴器小旋律（D8）',
  outputs: ['D8'],
  code: `const int BUZZ = 8;
// 實驗室開機音效：Do Mi Sol Do
int notes[] = {523, 659, 784, 1047, 784, 1047};
int beats[] = {150, 150, 150, 300, 150, 450};

void setup() {
  pinMode(BUZZ, OUTPUT); ⟦s1⟧
}

void loop() {
  for (int i = 0; i < 6; i++) { ⟦f⟧
    tone(BUZZ, notes[i]); ⟦t⟧
    delay(beats[i]); ⟦d⟧
    noTone(BUZZ); ⟦n⟧
    delay(40);
  }
  delay(1500);                 // 休息一下再播 ⟦w⟧
}`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    io.pinMode('D8', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        io.tone('D8', notes[i]);
        yield { at: 't', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('D8');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

export const FREE_PROGRAMS: ProgramDef[] = [P_BLINK_L, P_BLINK_D9, P_BUTTON, P_POT, P_SERVO, P_SONAR, P_MELODY];

/** 腳位和 Uno 不同的板子，自由建構用自己的範例程式（第 2 支是預設） */
export const FREE_PROGRAMS_BY_BOARD: Partial<Record<BoardId, ProgramDef[]>> = {
  esp32: ESP32_FREE_PROGRAMS,
  bluepill: BLUEPILL_FREE_PROGRAMS,
  rpi4: RPI4_FREE_PROGRAMS,
  pico: PICO_FREE_PROGRAMS,
  nodemcu: NODEMCU_FREE_PROGRAMS,
};
export const freePrograms = (b: BoardId): ProgramDef[] => FREE_PROGRAMS_BY_BOARD[b] ?? FREE_PROGRAMS;

/** 把程式碼拆成行：移除 ⟦tag⟧，記下 tag 所在行號 */
export function parseCode(code: string) {
  const lines: string[] = [];
  const tagLine: Record<string, number> = {};
  code.split('\n').forEach((raw, i) => {
    const m = raw.match(/\s*⟦(\w+)⟧\s*$/);
    if (m) tagLine[m[1]] = i;
    lines.push(m ? raw.slice(0, m.index).replace(/\s+$/, '') : raw);
  });
  return { lines, tagLine };
}

export function defaultParams(p: ProgramDef): Record<string, number> {
  return Object.fromEntries((p.params ?? []).map((x) => [x.key, x.def]));
}
