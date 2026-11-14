/**
 * Raspberry Pi Pico 的任務程式與自由建構程式（MicroPython）。
 * 寫法同 programs.ts：顯示用的程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 模擬器的 analogRead() 回傳 0–1023（滿刻度＝3.3 V），這裡換算成 MicroPython read_u16() 的 0–65535；
 * analogWrite() 吃 0–255，duty_u16() 的 0–65535 除以 257 換算。
 */
import type { ProgramDef } from './programs';

const toU16 = (v: number) => Math.round((v * 65535) / 1023);
const dutyToByte = (d: number) => Math.round(d / 257);

export const P_PICO_BLINK: ProgramDef = {
  id: 'pico-blink',
  title: '板上綠燈閃爍（GP25）',
  // GP25 沒有拉到排針，不會和外部電路短路，所以不列入上電前檢查
  outputs: [],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `from machine import Pin
import time

led = Pin(25, Pin.OUT)       # 板上綠燈接在 GP25 ⟦s1⟧

while True:                  # 一直重複（相當於 Arduino 的 loop）
    led.value(1)             # 3.3 V：燈亮 ⟦on⟧
    print("亮") ⟦p1⟧
    time.sleep_ms({{ms}}) ⟦d1⟧
    led.value(0)             # 0 V：燈滅 ⟦off⟧
    print("滅") ⟦p2⟧
    time.sleep_ms({{ms}}) ⟦d2⟧`,
  *run(io, p) {
    io.pinMode('GP25', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('GP25', 1);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('GP25', 0);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_PICO_LED: ProgramDef = {
  id: 'pico-led',
  title: '外接 LED 閃爍（GP15）',
  outputs: ['GP15'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `from machine import Pin
import time

led = Pin(15, Pin.OUT)       # GP15＝實體第 20 腳 ⟦s1⟧

while True:
    led.value(1)             # 電流：GP15 → 電阻 → LED → GND ⟦on⟧
    time.sleep_ms({{ms}}) ⟦d1⟧
    led.value(0) ⟦off⟧
    time.sleep_ms({{ms}}) ⟦d2⟧`,
  *run(io, p) {
    io.pinMode('GP15', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('GP15', 1);
      yield { at: 'on' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('GP15', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_PICO_BUTTON: ProgramDef = {
  id: 'pico-button',
  title: '按鈕控制 LED（GP14 → GP15）',
  outputs: ['GP15'],
  code: `from machine import Pin

button = Pin(14, Pin.IN, Pin.PULL_UP)   # 內建上拉：沒按＝1 ⟦s1⟧
led = Pin(15, Pin.OUT) ⟦s2⟧

while True:
    if button.value() == 0:             # 按下去了？ ⟦r⟧
        led.value(1) ⟦on⟧
    else:
        led.value(0) ⟦off⟧`,
  *run(io) {
    io.pinMode('GP14', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('GP15', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      const v = io.digitalRead('GP14');
      yield { at: 'r', wait: 8 };
      io.digitalWrite('GP15', v === 0 ? 1 : 0);
      yield { at: v === 0 ? 'on' : 'off', wait: 8 };
    }
  },
};

export const P_PICO_POT: ProgramDef = {
  id: 'pico-pot',
  title: '旋鈕調亮度（GP26 → GP15 PWM）',
  outputs: ['GP15'],
  code: `from machine import Pin, PWM, ADC
import time

knob = ADC(26)               # GP26＝ADC0，只有 GP26–GP28 能讀類比 ⟦s1⟧
led = PWM(Pin(15))           # 每支 GPIO 都能 PWM ⟦s2⟧
led.freq(1000)               # 每秒開關 1000 次，眼睛看不出閃爍 ⟦s3⟧

while True:
    val = knob.read_u16()    # 0–3.3 V → 0–65535 ⟦r⟧
    led.duty_u16(val)        # 亮度範圍也是 0–65535，直接用 ⟦w⟧
    print(val) ⟦p⟧
    time.sleep_ms(100) ⟦d⟧`,
  *run(io) {
    yield { at: 's1' };
    io.pinMode('GP15', 'OUTPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    for (;;) {
      const val = toU16(io.analogRead('GP26'));
      yield { at: 'r', wait: 4 };
      io.analogWrite('GP15', dutyToByte(val));
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const P_PICO_MELODY: ProgramDef = {
  id: 'pico-melody',
  title: 'PWM 蜂鳴器開機音效（GP18）',
  outputs: ['GP18'],
  code: `from machine import Pin, PWM
import time

buzz = PWM(Pin(18)) ⟦s1⟧
notes = [523, 659, 784, 1047, 784, 1047]   # Do Mi Sol Do
beats = [150, 150, 150, 300, 150, 450]

while True:
    for i in range(6): ⟦f⟧
        buzz.freq(notes[i])        # 頻率＝音高 ⟦t⟧
        buzz.duty_u16(32768)       # 一半時間 HIGH：發出聲音 ⟦on⟧
        time.sleep_ms(beats[i]) ⟦d⟧
        buzz.duty_u16(0)           # 停止 ⟦n⟧
        time.sleep_ms(40)
    time.sleep_ms(1500)            # 休息一下再播 ⟦w⟧`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    io.pinMode('GP18', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        yield { at: 't', wait: 1 };
        io.tone('GP18', notes[i]);
        yield { at: 'on', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('GP18');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

export const P_PICO_SERVO: ProgramDef = {
  id: 'pico-servo',
  title: '伺服機來回掃動（GP16）',
  outputs: ['GP16'],
  code: `from machine import Pin, PWM
import time

servo = PWM(Pin(16)) ⟦s1⟧
servo.freq(50)               # 伺服機要 50 Hz：每 20 ms 一個脈衝 ⟦s2⟧

def angle(a):
    us = 500 + a * 2000 // 180         # 0° ＝ 0.5 ms，180° ＝ 2.5 ms
    servo.duty_u16(us * 65535 // 20000)

while True:
    angle(0) ⟦a0⟧
    time.sleep(1) ⟦d1⟧
    angle(180) ⟦a1⟧
    time.sleep(1) ⟦d2⟧`,
  *run(io) {
    io.servoAttach('GP16');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.servoWrite('GP16', 0);
      yield { at: 'a0' };
      yield { at: 'd1', wait: 1000 };
      io.servoWrite('GP16', 180);
      yield { at: 'a1' };
      yield { at: 'd2', wait: 1000 };
    }
  },
};

export const PICO_FREE_PROGRAMS: ProgramDef[] = [P_PICO_BLINK, P_PICO_LED, P_PICO_BUTTON, P_PICO_POT, P_PICO_SERVO, P_PICO_MELODY];
