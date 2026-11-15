/**
 * Jetson Orin Nano Super 的任務程式與自由建構程式。
 * GPIO 用 Python＋Jetson.GPIO 的 BOARD 模式（程式裡的數字＝實體腳號，腳位 id 是 PIN＋腳號）；
 * AI 程式用 jetson-inference 的 detectNet，相機畫面和偵測結果由 src/sim/vision.ts 模擬。
 * 顯示用的程式碼和 programs.ts 一樣有 ⟦tag⟧ 高亮標記與 {{key}} 參數。
 */
import type { IO, ProgramDef } from './programs';
import { detect, fpsOf, useVision, type Det } from './vision';

export const P_JN_LED: ProgramDef = {
  id: 'jn-led',
  title: 'LED 閃爍（第 12 腳）',
  outputs: ['PIN12'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `# blink.py：在 Jetson 的終端機輸入 python3 blink.py
import Jetson.GPIO as GPIO        # 用法和樹莓派的 RPi.GPIO 幾乎一樣 ⟦s1⟧
import time

LED = 12                          # 排針上的第 12 腳
GPIO.setmode(GPIO.BOARD)          # BOARD 模式：數字＝實體腳號 ⟦s2⟧
GPIO.setup(LED, GPIO.OUT, initial=GPIO.LOW) ⟦s3⟧

try:
    while True:
        GPIO.output(LED, GPIO.HIGH)    # 3.3 V：燈亮 ⟦on⟧
        print("亮") ⟦p1⟧
        time.sleep({{ms}} / 1000)      # sleep() 的單位是秒 ⟦d1⟧
        GPIO.output(LED, GPIO.LOW)     # 0 V：燈滅 ⟦off⟧
        print("滅") ⟦p2⟧
        time.sleep({{ms}} / 1000) ⟦d2⟧
finally:
    GPIO.cleanup()                # 按 Ctrl+C 結束時把腳位恢復成輸入`,
  *run(io, p) {
    yield { at: 's1', wait: 150 };
    yield { at: 's2' };
    io.pinMode('PIN12', 'OUTPUT');
    io.digitalWrite('PIN12', 0);
    yield { at: 's3' };
    for (;;) {
      io.digitalWrite('PIN12', 1);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('PIN12', 0);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_JN_BUTTON: ProgramDef = {
  id: 'jn-button',
  title: '按鈕控制 LED（第 18 腳 → 第 12 腳）',
  outputs: ['PIN12'],
  code: `import Jetson.GPIO as GPIO ⟦s1⟧
import time

LED, BTN = 12, 18
GPIO.setmode(GPIO.BOARD)
GPIO.setup(LED, GPIO.OUT, initial=GPIO.LOW)
GPIO.setup(BTN, GPIO.IN)          # 沒辦法用程式開上拉：靠外加的 10kΩ ⟦s2⟧

try:
    while True:
        if GPIO.input(BTN) == GPIO.LOW:     # 按下去＝被拉到 GND ⟦rd⟧
            GPIO.output(LED, GPIO.HIGH) ⟦on⟧
        else:
            GPIO.output(LED, GPIO.LOW) ⟦off⟧
        time.sleep(0.02)          # 每秒檢查 50 次 ⟦w⟧
finally:
    GPIO.cleanup()`,
  *run(io) {
    yield { at: 's1', wait: 150 };
    io.pinMode('PIN12', 'OUTPUT');
    io.digitalWrite('PIN12', 0);
    io.pinMode('PIN18', 'INPUT');
    yield { at: 's2' };
    io.print('按按看！');
    let prev = -1;
    for (;;) {
      const v = io.digitalRead('PIN18');
      yield { at: 'rd', wait: 1 };
      io.digitalWrite('PIN12', v === 0 ? 1 : 0);
      yield { at: v === 0 ? 'on' : 'off', wait: 1 };
      if (v !== prev) {
        if (prev !== -1) io.print(v === 0 ? '按下 → 燈亮' : '放開 → 燈滅');
        prev = v;
      }
      yield { at: 'w', wait: 20 };
    }
  },
};

export const P_JN_PWM: ProgramDef = {
  id: 'jn-pwm',
  title: 'LED 呼吸燈（第 33 腳硬體 PWM）',
  outputs: ['PIN33'],
  code: `# 先執行 sudo /opt/nvidia/jetson-io/jetson-io.py 把第 33 腳設成 PWM，重開機
import Jetson.GPIO as GPIO ⟦s1⟧
import time

GPIO.setmode(GPIO.BOARD)
GPIO.setup(33, GPIO.OUT)
led = GPIO.PWM(33, 1000)          # 硬體 PWM，1000 Hz ⟦s2⟧
led.start(0)                      # 工作週期 0 %：全暗

while True:
    for duty in range(0, 101, 5):
        led.ChangeDutyCycle(duty)  # 越大越亮 ⟦up⟧
        time.sleep(0.05)
    for duty in range(100, -1, -5):
        led.ChangeDutyCycle(duty) ⟦dn⟧
        time.sleep(0.05)`,
  *run(io) {
    yield { at: 's1', wait: 150 };
    io.pinMode('PIN33', 'OUTPUT');
    yield { at: 's2' };
    io.print('呼吸中……按 Ctrl+C 結束');
    for (;;) {
      for (let d = 0; d <= 100; d += 5) {
        io.analogWrite('PIN33', Math.round(d * 2.55));
        yield { at: 'up', wait: 50 };
      }
      for (let d = 100; d >= 0; d -= 5) {
        io.analogWrite('PIN33', Math.round(d * 2.55));
        yield { at: 'dn', wait: 50 };
      }
    }
  },
};

/** SG90：50 Hz，0°＝0.5 ms（2.5 %）、180°＝2.5 ms（12.5 %） */
export const dutyOf = (angle: number) => 2.5 + (angle / 180) * 10;

export const P_JN_SERVO: ProgramDef = {
  id: 'jn-servo',
  title: '伺服機來回擺動（第 15 腳硬體 PWM）',
  outputs: ['PIN15'],
  params: [{ key: 'step', label: '每次轉幾度', def: 5, min: 1, max: 30 }],
  code: `# 先用 jetson-io.py 把第 15 腳設成 PWM，重開機
import Jetson.GPIO as GPIO ⟦s1⟧
import time

GPIO.setmode(GPIO.BOARD)
GPIO.setup(15, GPIO.OUT)
servo = GPIO.PWM(15, 50)          # 50 Hz：每 20 ms 一個脈衝 ⟦s2⟧
servo.start(7.5)                  # 7.5 %（1.5 ms）≈ 90°

def to_duty(angle):               # 0°→2.5 %、180°→12.5 %
    return 2.5 + angle / 180 * 10

while True:
    for a in range(0, 181, {{step}}):
        servo.ChangeDutyCycle(to_duty(a)) ⟦w1⟧
        time.sleep(0.02) ⟦d1⟧
    for a in range(180, -1, -{{step}}):
        servo.ChangeDutyCycle(to_duty(a)) ⟦w2⟧
        time.sleep(0.02) ⟦d2⟧`,
  *run(io, p) {
    const step = Math.max(1, p.step);
    yield { at: 's1', wait: 150 };
    io.servoAttach('PIN15');
    io.servoWrite('PIN15', 90);
    yield { at: 's2' };
    for (;;) {
      for (let a = 0; a <= 180; a += step) {
        io.servoWrite('PIN15', a);
        yield { at: 'w1', wait: 1 };
        yield { at: 'd1', wait: 20 };
      }
      for (let a = 180; a >= 0; a -= step) {
        io.servoWrite('PIN15', a);
        yield { at: 'w2', wait: 1 };
        yield { at: 'd2', wait: 20 };
      }
    }
  },
};

const names = (ds: Det[]) => `[${ds.map((d) => `'${d.label}'`).join(', ')}]`;

/** 載入模型、打開相機（兩支 AI 程式共用的開場） */
function* boot(io: IO, th: number) {
  io.print(`[TRT] 載入 ssd-mobilenet-v2（threshold=${th.toFixed(2)}）`);
  io.print('[TRT] 第一次執行會花幾分鐘把模型轉成 TensorRT 引擎，之後只要幾秒');
  yield { at: 'load', wait: 1100 };
  io.print('[TRT] 引擎就緒：FP16 精度，在 GPU 上執行');
  yield { at: 'cam', wait: 250 };
  useVision.getState().open();
  io.print('[gstreamer] 相機 csi://0 已開啟 1280×720');
}

export const P_JN_DETECT: ProgramDef = {
  id: 'jn-detect-ai',
  title: 'AI 看到人就亮燈（CSI 相機＋第 12 腳）',
  outputs: ['PIN12'],
  params: [{ key: 'th', label: '信心門檻（%）', def: 50, min: 10, max: 95 }],
  code: `# detect.py：用 GPU 偵測相機畫面裡的東西
from jetson_inference import detectNet   # NVIDIA 的推論函式庫 ⟦s1⟧
from jetson_utils import videoSource
import Jetson.GPIO as GPIO

GPIO.setmode(GPIO.BOARD)
GPIO.setup(12, GPIO.OUT, initial=GPIO.LOW) ⟦s2⟧

# 預先訓練好的模型，認得人、貓、瓶子等 90 種東西
net = detectNet("ssd-mobilenet-v2", threshold={{th}} / 100) ⟦load⟧
camera = videoSource("csi://0")          # 插在 CAM0 的相機 ⟦cam⟧
frame = 0

while True:
    img = camera.Capture()               # 抓一張畫面，直接放在 GPU 記憶體 ⟦cap⟧
    detections = net.Detect(img)         # 在 GPU 上推論 ⟦det⟧
    names = [net.GetClassDesc(d.ClassID) for d in detections]
    if "person" in names: ⟦if⟧
        GPIO.output(12, GPIO.HIGH)       # 看到人 → 亮燈 ⟦on⟧
    else:
        GPIO.output(12, GPIO.LOW) ⟦off⟧
    frame += 1
    if frame % 30 == 0:
        print(names, f"{net.GetNetworkFPS():.0f} FPS") ⟦p⟧`,
  *run(io, p) {
    useVision.getState().reset();
    const th = Math.max(0.1, Math.min(0.95, (p.th ?? 50) / 100));
    yield { at: 's1', wait: 300 };
    io.pinMode('PIN12', 'OUTPUT');
    io.digitalWrite('PIN12', 0);
    yield { at: 's2' };
    yield* boot(io, th);
    let t = 0;
    let n = 0;
    let prev = '';
    for (;;) {
      const fps = fpsOf(useVision.getState().mode);
      const dt = 1000 / fps;
      useVision.getState().advance(dt);
      yield { at: 'cap', wait: dt * 0.25 };
      const dets = detect(t, th);
      yield { at: 'det', wait: dt * 0.75 };
      t += dt;
      const person = dets.some((d) => d.label === 'person');
      yield { at: 'if', wait: 0 };
      io.digitalWrite('PIN12', person ? 1 : 0);
      yield { at: person ? 'on' : 'off', wait: 0 };
      useVision.getState().frame(dets, fps);
      n++;
      const now = names(dets);
      if (n % 30 === 0 || now !== prev) {
        io.print(`${now} ${fps} FPS`);
        prev = now;
        yield { at: 'p', wait: 0 };
      }
    }
  },
};

export const P_JN_TRACK: ProgramDef = {
  id: 'jn-track-ai',
  title: 'AI 雲台：伺服機指著人（第 15 腳）',
  outputs: ['PIN15'],
  params: [{ key: 'kp', label: '追蹤速度（1–10）', def: 3, min: 1, max: 10 }],
  code: `# track.py：伺服機一直指著畫面裡的人
from jetson_inference import detectNet
from jetson_utils import videoSource
import Jetson.GPIO as GPIO ⟦s1⟧

GPIO.setmode(GPIO.BOARD)
GPIO.setup(15, GPIO.OUT)
servo = GPIO.PWM(15, 50)                 # 第 15 腳硬體 PWM ⟦s2⟧
servo.start(7.5)                         # 先轉到 90°
angle = 90

net = detectNet("ssd-mobilenet-v2", threshold=0.5) ⟦load⟧
camera = videoSource("csi://0") ⟦cam⟧

while True:
    img = camera.Capture() ⟦cap⟧
    people = [d for d in net.Detect(img)
              if net.GetClassDesc(d.ClassID) == "person"] ⟦det⟧
    if people:
        x = people[0].Center[0] / img.width     # 0＝最左、1＝最右 ⟦x⟧
        target = x * 180                         # 換成伺服機角度
        angle += ({{kp}} / 10) * (target - angle)  # 每次只追一部分，才不會抖 ⟦pid⟧
        servo.ChangeDutyCycle(2.5 + angle / 180 * 10) ⟦w⟧`,
  *run(io, p) {
    useVision.getState().reset();
    const k = Math.max(1, Math.min(10, p.kp ?? 3)) / 10;
    yield { at: 's1', wait: 300 };
    io.servoAttach('PIN15');
    io.servoWrite('PIN15', 90);
    yield { at: 's2' };
    yield* boot(io, 0.5);
    let angle = 90;
    let t = 0;
    let n = 0;
    for (;;) {
      const fps = fpsOf(useVision.getState().mode);
      const dt = 1000 / fps;
      useVision.getState().advance(dt);
      yield { at: 'cap', wait: dt * 0.25 };
      const dets = detect(t, 0.5).filter((d) => d.label === 'person');
      yield { at: 'det', wait: dt * 0.75 };
      t += dt;
      useVision.getState().frame(dets, fps);
      n++;
      if (dets.length) {
        const x = dets[0].cx;
        yield { at: 'x', wait: 0 };
        angle += k * (x * 180 - angle);
        yield { at: 'pid', wait: 0 };
        io.servoWrite('PIN15', angle);
        useVision.getState().track(angle, x);
        yield { at: 'w', wait: 0 };
        if (n % 30 === 0) io.print(`人在 x=${x.toFixed(2)} → 伺服機 ${angle.toFixed(0)}°  ${fps} FPS`);
      } else if (n % 30 === 0) io.print(`沒看到人，停在 ${angle.toFixed(0)}°`);
    }
  },
};

/** 自由建構的範例程式（第 2 支是預設） */
export const JETSON_FREE_PROGRAMS: ProgramDef[] = [P_JN_LED, P_JN_BUTTON, P_JN_PWM, P_JN_SERVO, P_JN_DETECT, P_JN_TRACK];
