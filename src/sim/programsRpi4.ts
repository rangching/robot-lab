/**
 * Raspberry Pi 4 的任務程式與自由建構程式。
 * Pi 跑的是 Linux，程式用 Python＋gpiozero 寫；顯示用的程式碼和 programs.ts 一樣有 ⟦tag⟧ 高亮標記與 {{key}} 參數，
 * 底下的 generator 只是用模擬器的 IO 介面重現同樣的行為（腳位 id 是 GPIO＋BCM 編號）。
 */
import type { IO, ProgramDef } from './programs';
import { useWeb } from './web';

export const P_PI_LED: ProgramDef = {
  id: 'pi-led',
  title: 'LED 閃爍（GPIO17）',
  outputs: ['GPIO17'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `# blink.py：在 Pi 的終端機輸入 python3 blink.py 執行
from gpiozero import LED          # 樹莓派內建的 GPIO 函式庫 ⟦s1⟧
from time import sleep

led = LED(17)                     # BCM 17＝實體第 11 腳 ⟦s2⟧

while True:                       # 一直重複，按 Ctrl+C 結束
    led.on()                      # GPIO17 輸出 3.3 V ⟦on⟧
    print("亮") ⟦p1⟧
    sleep({{ms}} / 1000)          # sleep() 的單位是秒 ⟦d1⟧
    led.off()                     # 0 V：燈滅 ⟦off⟧
    print("滅") ⟦p2⟧
    sleep({{ms}} / 1000) ⟦d2⟧`,
  *run(io, p) {
    yield { at: 's1', wait: 120 };
    io.pinMode('GPIO17', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('GPIO17', 1);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('GPIO17', 0);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_PI_PULSE: ProgramDef = {
  id: 'pi-pulse',
  title: 'LED 呼吸燈（GPIO17 軟體 PWM）',
  outputs: ['GPIO17'],
  code: `from gpiozero import PWMLED ⟦s1⟧
from signal import pause

led = PWMLED(17)                  # 任何 GPIO 都能用軟體 PWM ⟦s2⟧
led.pulse(fade_in_time=1, fade_out_time=1)   # 在背景自己漸亮漸暗 ⟦p⟧
print("呼吸中……按 Ctrl+C 結束")
pause()                           # 主程式停在這裡等 ⟦w⟧`,
  *run(io) {
    yield { at: 's1', wait: 120 };
    io.pinMode('GPIO17', 'OUTPUT');
    yield { at: 's2' };
    io.print('呼吸中……按 Ctrl+C 結束');
    for (;;) {
      for (let i = 0; i <= 20; i++) {
        io.analogWrite('GPIO17', Math.round((i / 20) ** 2 * 255));
        yield { at: 'p', wait: 50 };
      }
      for (let i = 20; i >= 0; i--) {
        io.analogWrite('GPIO17', Math.round((i / 20) ** 2 * 255));
        yield { at: 'w', wait: 50 };
      }
    }
  },
};

export const P_PI_BUTTON: ProgramDef = {
  id: 'pi-button',
  title: '按鈕控制 LED（GPIO27 → GPIO17）',
  outputs: ['GPIO17'],
  code: `from gpiozero import LED, Button ⟦s1⟧
from signal import pause

led = LED(17)
button = Button(27)               # 預設開內建上拉：沒按＝高電位 ⟦s2⟧

button.when_pressed = led.on      # 按下去就呼叫 led.on（注意沒有括號） ⟦on⟧
button.when_released = led.off    # 放開就呼叫 led.off ⟦off⟧

print("按按看！")
pause()                           # 程式停在這裡，等事件發生 ⟦w⟧`,
  *run(io) {
    yield { at: 's1', wait: 120 };
    io.pinMode('GPIO17', 'OUTPUT');
    io.pinMode('GPIO27', 'INPUT_PULLUP');
    yield { at: 's2' };
    io.print('按按看！');
    let prev = 1;
    for (;;) {
      const v = io.digitalRead('GPIO27');
      if (v !== prev) {
        io.digitalWrite('GPIO17', v === 0 ? 1 : 0);
        io.print(v === 0 ? '按下 → 燈亮' : '放開 → 燈滅');
        prev = v;
        yield { at: v === 0 ? 'on' : 'off', wait: 30 };
      } else yield { at: 'w', wait: 8 };
    }
  },
};

function* sweep(io: IO, pin: string, step: number) {
  for (;;) {
    for (let a = 0; a <= 180; a += step) {
      io.servoWrite(pin, a);
      yield { at: 'w1', wait: 1 };
      yield { at: 'd1', wait: 20 };
    }
    for (let a = 180; a >= 0; a -= step) {
      io.servoWrite(pin, a);
      yield { at: 'w2', wait: 1 };
      yield { at: 'd2', wait: 20 };
    }
  }
}

export const P_PI_SERVO: ProgramDef = {
  id: 'pi-servo',
  title: '伺服機來回擺動（GPIO18 硬體 PWM）',
  outputs: ['GPIO18'],
  params: [{ key: 'step', label: '每次轉幾度', def: 5, min: 1, max: 30 }],
  code: `# 先在終端機執行 sudo pigpiod，啟動產生精準脈衝的背景服務
from gpiozero import AngularServo
from gpiozero.pins.pigpio import PiGPIOFactory ⟦s1⟧
from time import sleep

servo = AngularServo(18, min_angle=0, max_angle=180,
                     min_pulse_width=0.0005, max_pulse_width=0.0025,
                     pin_factory=PiGPIOFactory())   # GPIO18 有硬體 PWM ⟦s2⟧

while True:
    for angle in range(0, 181, {{step}}):
        servo.angle = angle ⟦w1⟧
        sleep(0.02) ⟦d1⟧
    for angle in range(180, -1, -{{step}}):
        servo.angle = angle ⟦w2⟧
        sleep(0.02) ⟦d2⟧`,
  *run(io, p) {
    yield { at: 's1', wait: 150 };
    io.servoAttach('GPIO18');
    yield { at: 's2' };
    yield* sweep(io, 'GPIO18', Math.max(1, p.step));
  },
};

export const P_PI_BUZZER: ProgramDef = {
  id: 'pi-buzzer',
  title: '蜂鳴器小旋律（GPIO18）',
  outputs: ['GPIO18'],
  code: `from gpiozero import TonalBuzzer ⟦s1⟧
from gpiozero.tones import Tone
from time import sleep

buzz = TonalBuzzer(18)            # 無源蜂鳴器：＋接 GPIO18，−接 GND
notes = ["C5", "E5", "G5", "C6", "G5", "C6"]
beats = [0.15, 0.15, 0.15, 0.3, 0.15, 0.45]

while True:
    for n, b in zip(notes, beats): ⟦f⟧
        buzz.play(Tone(n)) ⟦t⟧
        sleep(b) ⟦d⟧
        buzz.stop() ⟦n⟧
        sleep(0.04)
    sleep(1.5) ⟦w⟧`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    yield { at: 's1', wait: 120 };
    io.pinMode('GPIO18', 'OUTPUT');
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        io.tone('GPIO18', notes[i]);
        yield { at: 't', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('GPIO18');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

export const P_PI_SONAR: ProgramDef = {
  id: 'pi-sonar',
  title: '超音波測距（TRIG GPIO23／ECHO GPIO24）',
  outputs: ['GPIO23'],
  code: `# 注意：HC-SR04 接 5 V 時 ECHO 會送出 5 V，
# 實際接線要用 1kΩ＋2kΩ 分壓再進 GPIO24，否則會燒壞 Pi
from gpiozero import DistanceSensor ⟦s1⟧
from time import sleep

sensor = DistanceSensor(echo=24, trigger=23, max_distance=2) ⟦s2⟧

while True:
    cm = sensor.distance * 100    # distance 的單位是公尺 ⟦cm⟧
    print(f"距離：{cm:.1f} cm") ⟦p⟧
    sleep(0.2) ⟦d⟧`,
  *run(io) {
    yield { at: 's1', wait: 120 };
    io.pinMode('GPIO23', 'OUTPUT');
    io.pinMode('GPIO24', 'INPUT');
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('GPIO23', 1);
      io.digitalWrite('GPIO23', 0);
      const t = io.pulseIn('GPIO24', 'GPIO23');
      yield { at: 'cm', wait: Math.max(4, t / 1000) };
      io.print(t === 0 ? '距離：0.0 cm（沒有收到回音）' : `距離：${((t * 0.0343) / 2).toFixed(1)} cm`);
      yield { at: 'p', wait: 3 };
      yield { at: 'd', wait: 200 };
    }
  },
};

/** Pi 在區網裡的位址；Flask 開在 5000 埠 */
export const PI_WEB_ADDR = '192.168.1.42:5000';

export const P_PI_FLASK: ProgramDef = {
  id: 'pi-flask-wifi',
  title: 'Flask 網頁開關燈（GPIO17）',
  outputs: ['GPIO17'],
  code: `# web.py：Pi 自己就是一台網頁伺服器
from flask import Flask ⟦s1⟧
from gpiozero import LED

app = Flask(__name__)
led = LED(17) ⟦s2⟧

@app.route("/on")                 # 有人打開 /on 這一頁 ⟦r1⟧
def turn_on():
    led.on() ⟦on⟧
    return "LED 已開"

@app.route("/off") ⟦r2⟧
def turn_off():
    led.off() ⟦off⟧
    return "LED 已關"

# 0.0.0.0：讓同一個區網的手機也連得進來
app.run(host="0.0.0.0", port=5000) ⟦run⟧`,
  *run(io) {
    useWeb.getState().reset();
    yield { at: 's1', wait: 300 };
    io.pinMode('GPIO17', 'OUTPUT');
    yield { at: 's2' };
    yield { at: 'r1' };
    yield { at: 'r2' };
    useWeb.getState().connect(PI_WEB_ADDR);
    io.print(' * Serving Flask app "web"');
    io.print(` * Running on http://${PI_WEB_ADDR}/`);
    yield { at: 'run', wait: 50 };
    for (;;) {
      const req = useWeb.getState().take();
      yield { at: 'run', wait: 20 };
      if (req === '/on' || req === '/off') {
        const on = req === '/on';
        yield { at: on ? 'r1' : 'r2', wait: 30 };
        io.digitalWrite('GPIO17', on ? 1 : 0);
        io.print(`192.168.1.23 - "GET ${req} HTTP/1.1" 200 -`);
        useWeb.getState().served(req, on);
        yield { at: on ? 'on' : 'off', wait: 60 };
      } else if (req !== undefined) {
        io.print(`192.168.1.23 - "GET ${req} HTTP/1.1" 404 -`);
      }
    }
  },
};

/** 自由建構的範例程式（第 2 支是預設） */
export const RPI4_FREE_PROGRAMS: ProgramDef[] = [P_PI_LED, P_PI_PULSE, P_PI_BUTTON, P_PI_SERVO, P_PI_BUZZER, P_PI_SONAR, P_PI_FLASK];
