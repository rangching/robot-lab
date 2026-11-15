/**
 * Pololu 3pi+ 2040 的任務程式與自由建構程式（MicroPython，官方 pololu_3pi_2040_robot 函式庫）。
 * 寫法同 programs.ts：顯示用的程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 車子的物理在 src/sim/drive.ts，程式每次等待都用 botAdvance() 把模擬往前推同樣的時間。
 * 程式 id 結尾一律是 -bot：工作台會顯示 3pi+ 面板（OLED、按鈕 A／B／C、感測器讀值）。
 */
import type { Gen, IO, ProgramDef } from './programs';
import { botAdvance, botSim, botStart, useBot } from './bot';
import { COUNTS_PER_CM, BOT, deg, type LayoutId } from './drive';

/** 每支程式用哪一塊場地 */
export const BOT_LAYOUT: Record<string, LayoutId> = {};
const withLayout = (p: ProgramDef, l: LayoutId): ProgramDef => {
  BOT_LAYOUT[p.id] = l;
  return p;
};
export const layoutOf = (programId: string): LayoutId => BOT_LAYOUT[programId] ?? 'open';

/** 等待 ms 毫秒（time.sleep_ms），同時推進車子的物理 */
function* sleep(ms: number, at: string): Gen {
  let left = ms;
  while (left > 0) {
    const h = Math.min(10, left);
    botAdvance(h);
    left -= h;
    yield { at, wait: h };
  }
}

/** 執行一行程式（預設 1 毫秒），模擬時間和引擎時間保持一致 */
function* at(tag: string, ms = 1): Gen {
  botAdvance(ms);
  yield { at: tag, wait: ms };
}

/** while not button_a.check(): pass */
function* waitA(at: string, oled?: string[]): Gen {
  if (oled) useBot.getState().setOled(oled);
  for (;;) {
    if (useBot.getState().take('A')) return;
    botAdvance(20);
    yield { at, wait: 20 };
  }
}

const sim = () => botSim()!;
const r1 = (v: number) => Math.round(v * 10) / 10;

const HEADER = `from pololu_3pi_2040_robot import robot
import time
`;

// ---------- 1. 前進、後退 ----------
export const P_TP_DRIVE = withLayout({
  id: 'tp-drive-bot',
  title: '前進一下、再倒車回來',
  outputs: [],
  params: [
    { key: 'spd', label: '速度（0–6000）', def: 1500, min: 300, max: 6000 },
    { key: 'ms', label: '行駛毫秒', def: 800, min: 100, max: 3000 },
  ],
  code: `${HEADER}
motors = robot.Motors()
display = robot.Display()
button_a = robot.ButtonA()

while True:
    display.fill(0)
    display.text("Press A", 36, 28)
    display.show()
    while not button_a.check():          # 先把車子放好，按 A 才出發 ⟦wa⟧
        pass
    time.sleep_ms(500)                   # 讓手離開車子 ⟦d0⟧
    motors.set_speeds({{spd}}, {{spd}})        # 左輪、右輪同速往前 ⟦fwd⟧
    time.sleep_ms({{ms}}) ⟦d1⟧
    motors.set_speeds(-{{spd}}, -{{spd}})      # 負數＝倒車 ⟦back⟧
    time.sleep_ms({{ms}}) ⟦d2⟧
    motors.off()                         # 停車 ⟦off⟧`,
  *run(io: IO, p) {
    botStart('open');
    for (;;) {
      yield* waitA('wa', ['', '', '', '    Press A']);
      useBot.getState().setOled(['', '', '', '    GO!']);
      yield* sleep(500, 'd0');
      sim().setSpeeds(p.spd, p.spd);
      io.print(`前進：速度 ${p.spd}`);
      yield* at('fwd');
      yield* sleep(p.ms, 'd1');
      sim().setSpeeds(-p.spd, -p.spd);
      io.print('倒車');
      yield* at('back');
      yield* sleep(p.ms, 'd2');
      sim().setSpeeds(0, 0);
      yield* at('off');
      yield* sleep(300, 'off');
      const [l, r] = sim().counts();
      io.print(`停車。編碼器 左 ${l}、右 ${r}`);
    }
  },
}, 'open');

// ---------- 2. 原地轉彎 ----------
export const P_TP_TURN = withLayout({
  id: 'tp-turn-bot',
  title: '原地左轉 90°（用時間控制）',
  outputs: [],
  params: [
    { key: 'spd', label: '速度', def: 1000, min: 300, max: 4000 },
    { key: 'ms', label: '轉多久（毫秒）', def: 200, min: 50, max: 2000 },
  ],
  code: `${HEADER}import math

motors = robot.Motors()
encoders = robot.Encoders()
display = robot.Display()
button_a = robot.ButtonA()

COUNTS_PER_CM = 35.6     # 358.3 counts ÷ 輪子周長（π × 3.2 cm）
WHEEL_GAP = 8.55         # 兩輪中心距離（cm，估計值）

display.fill(0)
display.text("A: turn left", 0, 0)
display.show()
while True:
    while not button_a.check(): ⟦wa⟧
        pass
    encoders.get_counts(reset=True)           # 編碼器歸零 ⟦z⟧
    motors.set_speeds(-{{spd}}, {{spd}})            # 左輪退、右輪進＝原地左轉 ⟦turn⟧
    time.sleep_ms({{ms}}) ⟦d1⟧
    motors.off() ⟦off⟧
    time.sleep_ms(300)                        # 等車子完全停下 ⟦d2⟧
    left, right = encoders.get_counts() ⟦read⟧
    arc = (right - left) / 2 / COUNTS_PER_CM  # 每個輪子沿圓周走了幾 cm
    angle = math.degrees(arc / (WHEEL_GAP / 2)) ⟦calc⟧
    print("轉了", round(angle), "度") ⟦p⟧
    display.fill(0)
    display.text("A: turn left", 0, 0)
    display.text(str(round(angle)) + " deg", 0, 24)
    display.show()`,
  *run(io: IO, p) {
    botStart('open');
    useBot.getState().setOled(['A: turn left']);
    for (;;) {
      yield* waitA('wa');
      sim().counts(true);
      yield* at('z');
      const before = sim().stats.turn;
      sim().setSpeeds(-p.spd, p.spd);
      yield* at('turn');
      yield* sleep(p.ms, 'd1');
      sim().setSpeeds(0, 0);
      yield* at('off');
      yield* sleep(300, 'd2');
      const [l, r] = sim().counts();
      yield* at('read');
      const angle = deg(((r - l) / 2 / COUNTS_PER_CM) / (BOT.trackW * 50));
      yield* at('calc');
      io.print(`轉了 ${Math.round(angle)} 度`);
      useBot.setState({ lastTurn: sim().stats.turn - before });
      useBot.getState().setOled(['A: turn left', '', '', `${Math.round(angle)} deg`]);
      yield* at('p');
    }
  },
}, 'open');

// ---------- 3. 編碼器量距離 ----------
export const P_TP_ODO = withLayout({
  id: 'tp-odo-bot',
  title: '用編碼器走準確的距離',
  outputs: [],
  params: [
    { key: 'cm', label: '目標距離（cm）', def: 30, min: 5, max: 60 },
    { key: 'spd', label: '速度', def: 1500, min: 300, max: 6000 },
  ],
  code: `${HEADER}
motors = robot.Motors()
encoders = robot.Encoders()
display = robot.Display()
button_a = robot.ButtonA()

COUNTS_PER_CM = 35.6           # 輪子轉一圈 358.3 counts、走 10.05 cm
target = {{cm}} * COUNTS_PER_CM ⟦t⟧

display.fill(0)
display.text("A: go {{cm}} cm", 0, 0)
display.show()
while True:
    while not button_a.check(): ⟦wa⟧
        pass
    encoders.get_counts(reset=True) ⟦z⟧
    motors.set_speeds({{spd}}, {{spd}}) ⟦go⟧
    while True:
        left, right = encoders.get_counts() ⟦read⟧
        if (left + right) / 2 >= target:    # 兩輪平均＝車子中心走的距離 ⟦chk⟧
            break
    motors.off() ⟦off⟧
    time.sleep_ms(300) ⟦d2⟧
    left, right = encoders.get_counts()
    print("左", left, "右", right, "≈", round((left + right) / 2 / COUNTS_PER_CM, 1), "cm") ⟦p⟧
    display.text("L " + str(left), 0, 24)
    display.text("R " + str(right), 0, 36)
    display.show()`,
  *run(io: IO, p) {
    botStart('open');
    const target = p.cm * COUNTS_PER_CM;
    yield* at('t');
    useBot.getState().setOled([`A: go ${p.cm} cm`]);
    for (;;) {
      yield* waitA('wa');
      sim().counts(true);
      yield* at('z');
      const s0 = sim();
      const [x0, y0, th0] = [s0.x, s0.y, s0.th];
      sim().setSpeeds(p.spd, p.spd);
      yield* at('go');
      for (;;) {
        const [l, r] = sim().counts();
        if ((l + r) / 2 >= target) break;
        yield* at('chk', 2);
      }
      sim().setSpeeds(0, 0);
      yield* at('off');
      yield* sleep(300, 'd2');
      const [l, r] = sim().counts();
      const s = sim();
      const actual = ((s.x - x0) * Math.cos(th0) + (s.y - y0) * Math.sin(th0)) * 100;
      io.print(`左 ${l} 右 ${r} ≈ ${r1((l + r) / 2 / COUNTS_PER_CM)} cm（尺量：${r1(actual)} cm）`);
      useBot.setState({ odo: { target: p.cm, actual } });
      useBot.getState().setOled([`A: go ${p.cm} cm`, '', `L ${l}`, `R ${r}`]);
      yield* at('p');
    }
  },
}, 'open');

// ---------- 4. 碰撞避障 ----------
export const P_TP_BUMP = withLayout({
  id: 'tp-bump-bot',
  title: '撞到就倒車轉向（碰撞開關）',
  outputs: [],
  params: [
    { key: 'spd', label: '速度', def: 1500, min: 300, max: 4000 },
    { key: 'turn', label: '轉向毫秒', def: 250, min: 50, max: 1000 },
  ],
  code: `${HEADER}
motors = robot.Motors()
bump = robot.BumpSensors()
display = robot.Display()
button_a = robot.ButtonA()

bump.calibrate()          # 開機校正：這時候不要碰保險桿 ⟦cal⟧
display.fill(0)
display.text("Press A", 36, 28)
display.show()
while not button_a.check(): ⟦wa⟧
    pass

while True:
    bump.read() ⟦read⟧
    if bump.left_is_pressed():        # 左邊撞到 ⟦L⟧
        motors.set_speeds(-{{spd}}, -{{spd}})    # 先倒車 ⟦lb⟧
        time.sleep_ms(250)
        motors.set_speeds({{spd}}, -{{spd}})     # 再往右轉開 ⟦lt⟧
        time.sleep_ms({{turn}})
    elif bump.right_is_pressed():     # 右邊撞到 ⟦R⟧
        motors.set_speeds(-{{spd}}, -{{spd}}) ⟦rb⟧
        time.sleep_ms(250)
        motors.set_speeds(-{{spd}}, {{spd}})     # 往左轉開 ⟦rt⟧
        time.sleep_ms({{turn}})
    else:
        motors.set_speeds({{spd}}, {{spd}})      # 沒撞到就直走 ⟦go⟧`,
  *run(io: IO, p) {
    botStart('boxes');
    yield* sleep(100, 'cal');
    yield* waitA('wa', ['', '', '', '    Press A']);
    useBot.getState().setOled(['Bumper demo', '', 'L: -', 'R: -']);
    for (;;) {
      const s = sim();
      yield* at('read');
      if (s.bumpL) {
        io.print('左邊撞到 → 倒車、右轉');
        useBot.getState().setOled(['Bumper demo', '', 'L: HIT', 'R: -']);
        s.setSpeeds(-p.spd, -p.spd);
        yield* at('lb');
        yield* sleep(250, 'lb');
        s.setSpeeds(p.spd, -p.spd);
        yield* sleep(p.turn, 'lt');
      } else if (s.bumpR) {
        io.print('右邊撞到 → 倒車、左轉');
        useBot.getState().setOled(['Bumper demo', '', 'L: -', 'R: HIT']);
        s.setSpeeds(-p.spd, -p.spd);
        yield* at('rb');
        yield* sleep(250, 'rb');
        s.setSpeeds(-p.spd, p.spd);
        yield* sleep(p.turn, 'rt');
      } else {
        s.setSpeeds(p.spd, p.spd);
        yield* sleep(4, 'go');
      }
    }
  },
}, 'boxes');

// ---------- 5、6. 循線 ----------
/** 原地左右擺動，讓每顆感測器都看過白底和黑線（和官方範例相同的做法） */
function* calibrateLine(io: IO): Gen {
  useBot.getState().setOled(['Calibrating...']);
  io.print('校正循線感測器：原地左右擺動');
  for (const [n, l, r] of [[40, 1000, -1000], [80, -1000, 1000], [40, 1000, -1000]] as const) {
    sim().setSpeeds(l, r);
    for (let i = 0; i < n; i++) {
      sim().calibrate();
      yield* at('cal', 5);
    }
  }
  sim().setSpeeds(0, 0);
  yield* sleep(300, 'cal');
}

/** 官方 line_follower.py 的線位置算法：1000～4000 的加權平均；中間三顆都看不到線時，照上次偏的方向給 0 或 4000 */
export function linePosition(line: number[], lastP: number) {
  if (line[1] < 700 && line[2] < 700 && line[3] < 700) return lastP < 0 ? 0 : 4000;
  const total = line.reduce((a, b) => a + b, 0);
  return Math.floor((1000 * line[1] + 2000 * line[2] + 3000 * line[3] + 4000 * line[4]) / total);
}

const FOLLOW_SETUP = `${HEADER}
motors = robot.Motors()
line_sensors = robot.LineSensors()
display = robot.Display()
button_a = robot.ButtonA()

display.fill(0)
display.text("A: calibrate", 0, 0)
display.show()
while not button_a.check(): ⟦wa⟧
    pass
# 原地左右擺動，讓 5 顆感測器都看過白底和黑線
for speeds, n in (((1000, -1000), 40), ((-1000, 1000), 80), ((1000, -1000), 40)):
    motors.set_speeds(*speeds)
    for i in range(n):
        line_sensors.calibrate() ⟦cal⟧
motors.off()
time.sleep_ms(300)
`;

function* follow(io: IO, p: Record<string, number>, kd: number): Gen {
  yield* waitA('wa', ['A: calibrate']);
  yield* calibrateLine(io);
  useBot.getState().setOled(['Following...', '', `speed ${p.spd}`, kd ? `kp ${p.kp} kd ${kd}` : `kp ${p.kp}`]);
  io.print('開始循線');
  sim().startLap();
  let lastP = 0;
  let laps = 0;
  let derails = 0;
  for (;;) {
    const s = sim();
    const line = s.readCalibrated();
    yield* at('read');
    const l = linePosition(line, lastP);
    const pe = l - 2000;
    const d = pe - lastP;
    lastP = pe;
    const pid = Math.floor((pe * p.kp + d * kd) / 10);
    yield* at('pid');
    s.setSpeeds(Math.max(0, Math.min(p.spd, p.spd + pid)), Math.max(0, Math.min(p.spd, p.spd - pid)));
    yield* at('set', 2);
    if (s.stats.laps > laps) {
      laps = s.stats.laps;
      io.print(`第 ${laps} 圈${laps === 1 ? `：${r1(s.stats.lapMs / 1000)} 秒` : ''}`);
    }
    if (s.stats.derails > derails) {
      derails = s.stats.derails;
      io.print('脫軌了！看不到黑線');
    }
  }
}

export const P_TP_LINE_P = withLayout({
  id: 'tp-linep-bot',
  title: '循線：P 控制（比例）',
  outputs: [],
  params: [
    { key: 'spd', label: '最高速度', def: 1500, min: 300, max: 6000 },
    { key: 'kp', label: 'kp', def: 10, min: 0, max: 100 },
  ],
  code: `${FOLLOW_SETUP}
last_p = 0
while True:
    line = line_sensors.read_calibrated()    # 5 個 0–1000，越大越黑 ⟦read⟧
    if line[1] < 700 and line[2] < 700 and line[3] < 700:
        l = 0 if last_p < 0 else 4000        # 看不到線：往上次偏的那邊找
    else:
        l = (1000*line[1] + 2000*line[2] + 3000*line[3] + 4000*line[4]) // sum(line)
    p = l - 2000              # 0＝線在正中間；正數＝線偏右 ⟦pid⟧
    last_p = p
    pid = p * {{kp}} // 10        # 偏越多，修正越大
    left = max(0, min({{spd}}, {{spd}} + pid))
    right = max(0, min({{spd}}, {{spd}} - pid))
    motors.set_speeds(left, right) ⟦set⟧`,
  *run(io: IO, p) {
    botStart('oval');
    yield* follow(io, p, 0);
  },
}, 'oval');

export const P_TP_PID = withLayout({
  id: 'tp-pid-bot',
  title: '循線：PD 控制（加上微分）',
  outputs: [],
  params: [
    { key: 'spd', label: '最高速度', def: 5000, min: 300, max: 6000 },
    { key: 'kp', label: 'kp', def: 10, min: 0, max: 100 },
    { key: 'kd', label: 'kd', def: 0, min: 0, max: 1000 },
  ],
  code: `${FOLLOW_SETUP}
last_p = 0
while True:
    line = line_sensors.read_calibrated() ⟦read⟧
    if line[1] < 700 and line[2] < 700 and line[3] < 700:
        l = 0 if last_p < 0 else 4000
    else:
        l = (1000*line[1] + 2000*line[2] + 3000*line[3] + 4000*line[4]) // sum(line)
    p = l - 2000               # 比例：現在偏多少
    d = p - last_p             # 微分：偏移量變化得多快（正在衝過頭嗎？）
    last_p = p
    pid = (p * {{kp}} + d * {{kd}}) // 10 ⟦pid⟧
    left = max(0, min({{spd}}, {{spd}} + pid))
    right = max(0, min({{spd}}, {{spd}} - pid))
    motors.set_speeds(left, right) ⟦set⟧`,
  *run(io: IO, p) {
    botStart('wavy');
    yield* follow(io, p, p.kd);
  },
}, 'wavy');

// ---------- 自由建構：黃色 LED ----------
export const P_TP_BLINK = withLayout({
  id: 'tp-blink-bot',
  title: '黃色 LED 閃爍（GP25，低電位點亮）',
  // GP25 沒有拉到擴充排針，不列入上電前檢查
  outputs: [],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `from machine import Pin
import time

led = Pin(25, Pin.OUT)     # 黃色 LED 接在 GP25（和按鈕 A 共用） ⟦s1⟧

while True:
    led.value(0)           # 這顆 LED 是「低電位點亮」：寫 0 才亮 ⟦on⟧
    time.sleep_ms({{ms}}) ⟦d1⟧
    led.value(1) ⟦off⟧
    time.sleep_ms({{ms}}) ⟦d2⟧`,
  *run(io: IO, p) {
    botStart('open');
    io.pinMode('GP25', 'OUTPUT');
    yield* at('s1');
    for (;;) {
      io.digitalWrite('GP25', 0);
      yield* at('on');
      yield* sleep(p.ms, 'd1');
      io.digitalWrite('GP25', 1);
      yield* at('off');
      yield* sleep(p.ms, 'd2');
    }
  },
}, 'open');

export const THREEPI_FREE_PROGRAMS: ProgramDef[] = [P_TP_BLINK, P_TP_DRIVE, P_TP_TURN, P_TP_ODO, P_TP_BUMP, P_TP_LINE_P, P_TP_PID];
