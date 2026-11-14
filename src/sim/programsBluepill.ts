/**
 * STM32 Blue Pill 的任務程式與自由建構程式（STM32duino 核心）。
 * 寫法同 programs.ts：顯示用的 Arduino 程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 腳位直接用 STM32 名稱（PA8、PC13），和程式裡寫的一樣。
 * 模擬器的 analogRead() 回傳 0–1023（滿刻度＝板子的邏輯電壓），這裡換算成 12 位元 0–4095。
 */
import type { Gen, IO, ProgramDef } from './programs';

const to12bit = (v: number) => Math.round((v * 4095) / 1023);

export const P_BP_BLINK: ProgramDef = {
  id: 'bp-blink',
  title: '板上 LED 閃爍（PC13，LOW 才亮）',
  outputs: ['PC13'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `// Blue Pill 的板上 LED 接在 PC13，而且是「低電位點亮」
// （LED 一端接 3.3 V，另一端接 PC13：PC13 拉低，電流才流得過去）

void setup() {
  pinMode(PC13, OUTPUT);            // 設成輸出 ⟦s1⟧
  Serial.begin(115200);             // 預設走 USART1（PA9、PA10） ⟦s2⟧
}

void loop() {
  digitalWrite(PC13, LOW);          // LOW → 燈亮 ⟦on⟧
  Serial.println("亮"); ⟦p1⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(PC13, HIGH);         // HIGH → 燈滅 ⟦off⟧
  Serial.println("滅"); ⟦p2⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('PC13', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('PC13', 0);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('PC13', 1);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_BP_LED: ProgramDef = {
  id: 'bp-led',
  title: '外接 LED 閃爍（PA8）',
  outputs: ['PA8'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `const int LED = PA8;          // 板子印 A8，程式寫 PA8

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
}

void loop() {
  digitalWrite(LED, HIGH);    // 電流：PA8 → 電阻 → LED → GND ⟦on⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED, LOW); ⟦off⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('PA8', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('PA8', 1);
      yield { at: 'on' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('PA8', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_BP_POT: ProgramDef = {
  id: 'bp-pot',
  title: '旋鈕調亮度（PA0 → PA8 PWM）',
  outputs: ['PA8'],
  code: `const int KNOB = PA0;     // ADC 腳，最多只能進 3.3 V
const int LED = PA8;      // TIM1 的 PWM 腳

void setup() {
  analogReadResolution(12);         // 不寫的話只給 10 位元 ⟦s0⟧
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(115200); ⟦s2⟧
}

void loop() {
  int val = analogRead(KNOB);       // 0–3.3 V → 0–4095 ⟦r⟧
  analogWrite(LED, val / 16);       // 4096 ÷ 16 = 256 階亮度 ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    yield { at: 's0' };
    io.pinMode('PA8', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = to12bit(io.analogRead('PA0'));
      yield { at: 'r', wait: 2 };
      io.analogWrite('PA8', Math.floor(val / 16));
      yield { at: 'w', wait: 2 };
      io.print(String(val));
      yield { at: 'p', wait: 2 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const P_BP_IRQ: ProgramDef = {
  id: 'bp-irq',
  title: '按鈕中斷切換 LED（PB12 → PA8）',
  outputs: ['PA8'],
  code: `const int BUTTON = PB12;
const int LED = PA8;
volatile bool flip = false;        // 中斷裡會改的變數要加 volatile
unsigned long last = 0;

void onPress() {                   // 中斷服務程式：越短越好
  if (millis() - last > 150) {     // 150 ms 內的彈跳當作沒按
    flip = true;
    last = millis();
  }
}

void setup() {
  pinMode(BUTTON, INPUT_PULLUP); ⟦s1⟧
  pinMode(LED, OUTPUT); ⟦s2⟧
  // STM32 幾乎每支腳都能當外部中斷；按下時電位從 HIGH 掉到 LOW
  attachInterrupt(digitalPinToInterrupt(BUTTON), onPress, FALLING); ⟦s3⟧
}

void loop() {
  if (flip) { ⟦chk⟧
    flip = false;
    digitalWrite(LED, !digitalRead(LED));   // 亮變滅、滅變亮 ⟦tog⟧
  }
}`,
  *run(io) {
    io.pinMode('PB12', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('PA8', 'OUTPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    let prev = io.digitalRead('PB12');
    let led: 0 | 1 = 0;
    let last = -1000;
    let t = 0;
    for (;;) {
      // 用輪詢模擬硬體偵測下降緣：每 5 ms 看一次
      const v = io.digitalRead('PB12');
      const fell = prev === 1 && v === 0 && t - last > 150;
      prev = v;
      t += 5;
      if (fell) {
        last = t;
        yield { at: 'chk', wait: 1 };
        led = led ? 0 : 1;
        io.digitalWrite('PA8', led);
        yield { at: 'tog', wait: 4 };
      } else {
        yield { at: 'chk', wait: 5 };
      }
    }
  },
};

export const P_BP_SONAR: ProgramDef = {
  id: 'bp-sonar',
  title: '超音波測距（TRIG PB8／ECHO PB9）',
  outputs: ['PB8'],
  code: `const int TRIG = PB8;
const int ECHO = PB9;      // FT 腳：5 V 的 ECHO 可以直接接

void setup() {
  pinMode(TRIG, OUTPUT); ⟦s1⟧
  pinMode(ECHO, INPUT); ⟦s2⟧
  Serial.begin(115200); ⟦s3⟧
}

void loop() {
  digitalWrite(TRIG, HIGH);       // 10 µs 觸發脈衝 ⟦t1⟧
  delayMicroseconds(10); ⟦t2⟧
  digitalWrite(TRIG, LOW); ⟦t3⟧
  long t = pulseIn(ECHO, HIGH); ⟦pi⟧
  float cm = t * 0.0343 / 2; ⟦cm⟧
  Serial.print("距離："); Serial.print(cm); Serial.println(" cm"); ⟦p⟧
  delay(200); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('PB8', 'OUTPUT');
    yield { at: 's1' };
    io.pinMode('PB9', 'INPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    for (;;) {
      io.digitalWrite('PB8', 1);
      yield { at: 't1', wait: 3 };
      yield { at: 't2', wait: 3 };
      io.digitalWrite('PB8', 0);
      yield { at: 't3', wait: 3 };
      const t = io.pulseIn('PB9', 'PB8');
      yield { at: 'pi', wait: Math.max(4, t / 1000) };
      const cm = (t * 0.0343) / 2;
      yield { at: 'cm', wait: 3 };
      io.print(t === 0 ? '距離：0.00 cm（沒有收到回音）' : `距離：${cm.toFixed(2)} cm`);
      yield { at: 'p', wait: 3 };
      yield { at: 'd', wait: 200 };
    }
  },
};

function* sweep(io: IO, pin: string, step: number): Gen {
  for (;;) {
    for (let pos = 0; pos <= 180; pos += step) {
      yield { at: 'f1', wait: 1 };
      io.servoWrite(pin, pos);
      yield { at: 'w1', wait: 1 };
      yield { at: 'd1', wait: 15 };
    }
    for (let pos = 180; pos >= 0; pos -= step) {
      yield { at: 'f2', wait: 1 };
      io.servoWrite(pin, pos);
      yield { at: 'w2', wait: 1 };
      yield { at: 'd2', wait: 15 };
    }
  }
}

export const P_BP_SERVO: ProgramDef = {
  id: 'bp-servo',
  title: '伺服機來回擺動（PB6）',
  outputs: ['PB6'],
  params: [{ key: 'step', label: '每次轉幾度', def: 2, min: 1, max: 30 }],
  code: `#include <Servo.h>      // STM32duino 內建的 Servo 函式庫
Servo arm;

void setup() {
  arm.attach(PB6);           // TIM4 的腳；3.3 V 的訊號 SG90 看得懂 ⟦a⟧
}

void loop() {
  for (int pos = 0; pos <= 180; pos += {{step}}) { ⟦f1⟧
    arm.write(pos); ⟦w1⟧
    delay(15); ⟦d1⟧
  }
  for (int pos = 180; pos >= 0; pos -= {{step}}) { ⟦f2⟧
    arm.write(pos); ⟦w2⟧
    delay(15); ⟦d2⟧
  }
}`,
  *run(io, p) {
    io.servoAttach('PB6');
    yield { at: 'a' };
    yield* sweep(io, 'PB6', Math.max(1, Math.round(p.step)));
  },
};

export const P_BP_MELODY: ProgramDef = {
  id: 'bp-melody',
  title: '蜂鳴器小旋律（PB7）',
  outputs: ['PB7'],
  code: `const int BUZZ = PB7;
int notes[] = {523, 659, 784, 1047, 784, 1047};
int beats[] = {150, 150, 150, 300, 150, 450};

void setup() {
  pinMode(BUZZ, OUTPUT); ⟦s1⟧
}

void loop() {
  for (int i = 0; i < 6; i++) { ⟦f⟧
    tone(BUZZ, notes[i]);      // 由硬體計時器產生方波 ⟦t⟧
    delay(beats[i]); ⟦d⟧
    noTone(BUZZ); ⟦n⟧
    delay(40);
  }
  delay(1500); ⟦w⟧
}`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    io.pinMode('PB7', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        io.tone('PB7', notes[i]);
        yield { at: 't', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('PB7');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

/** 自由建構用（第 2 支是預設） */
export const BLUEPILL_FREE_PROGRAMS: ProgramDef[] = [P_BP_BLINK, P_BP_LED, P_BP_IRQ, P_BP_POT, P_BP_SONAR, P_BP_SERVO, P_BP_MELODY];
