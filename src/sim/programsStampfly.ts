/**
 * M5Stamp Fly 的任務程式與自由建構程式。
 * 寫法同 programs.ts：顯示用的 Arduino 程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 *
 * 飛控的物理與 400 Hz 控制迴圈由 src/sim/flight.ts 在引擎裡計算（這裡的 generator 只負責流程：
 * 讀遙控器、解鎖／上鎖、印遙測），參數則照程式畫面上的數字傳進去。
 * 程式名稱結尾是 -rc 的，工作台會顯示遙控器面板。
 */
import type { IO, ProgramDef } from './programs';
import { MOTORS, MOTOR_GPIO, MOTOR_NAME } from './flight';

const MOTOR_PINS = MOTORS.map((m) => MOTOR_GPIO[m]);
const f1 = (v: number) => v.toFixed(1);

export const P_SF_RGB: ProgramDef = {
  id: 'sf-rgb',
  title: '全彩燈閃爍（G39）',
  outputs: [],
  params: [{ key: 'ms', label: '等待毫秒', def: 400, min: 50, max: 3000 }],
  code: `// 開發板選 M5StampS3；需要 FastLED 程式庫
// 這支程式完全不碰馬達，裝著槳也安全
#include <FastLED.h>
CRGB led[1];

void setup() {
  FastLED.addLeds<WS2812, 39, GRB>(led, 1);  // 全彩燈接在 G39 ⟦s1⟧
  Serial.begin(115200); ⟦s2⟧
}

void loop() {
  led[0] = CRGB::Green;  FastLED.show();     // 亮綠燈 ⟦on⟧
  Serial.println("綠"); ⟦p1⟧
  delay({{ms}}); ⟦d1⟧
  led[0] = CRGB::Black;  FastLED.show();     // 熄燈 ⟦off⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('GPIO39', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('GPIO39', 1);
      yield { at: 'on' };
      io.print('綠');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('GPIO39', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_SF_MOTOR: ProgramDef = {
  id: 'sf-motor',
  title: '馬達逐顆測試（先拆槳！）',
  outputs: MOTOR_PINS,
  params: [{ key: 'duty', label: '測試油門（0–255）', def: 50, min: 10, max: 120 }],
  code: `// ⚠ 測試馬達前一定先把螺旋槳拆掉！
const int MOTOR[4] = {5, 42, 10, 41};      // FL、FR、RL、RR
const char* NAME[4] = {"FL", "FR", "RL", "RR"};

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    ledcAttachPin(MOTOR[i], i);             // 第 i 個 PWM 通道 ⟦s1⟧
    ledcSetup(i, 150000, 8);                // 150 kHz、8 位元 ⟦s2⟧
  }
}

void loop() {
  for (int i = 0; i < 4; i++) {             // 一次只轉一顆 ⟦f⟧
    Serial.printf("測試 %s 馬達\\n", NAME[i]); ⟦p⟧
    ledcWrite(i, {{duty}});                 // 低速轉一秒 ⟦on⟧
    delay(1000); ⟦d1⟧
    ledcWrite(i, 0);                        // 停 ⟦off⟧
    delay(500); ⟦d2⟧
  }
}`,
  *run(io, p) {
    for (const pin of MOTOR_PINS) io.pinMode(pin, 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      for (const m of MOTORS) {
        yield { at: 'f' };
        io.print(`測試 ${m} 馬達（${MOTOR_NAME[m]}）`);
        yield { at: 'p', wait: 20 };
        io.analogWrite(MOTOR_GPIO[m], p.duty);
        yield { at: 'on', wait: 1 };
        yield { at: 'd1', wait: 1000 };
        io.analogWrite(MOTOR_GPIO[m], 0);
        yield { at: 'off', wait: 1 };
        yield { at: 'd2', wait: 500 };
      }
    }
  },
};

export const P_SF_IMU: ProgramDef = {
  id: 'sf-imu-rc',
  title: 'IMU 姿態讀值（用遙控器模擬手拿傾斜）',
  outputs: [],
  code: `#include "imu.hpp"                         // 官方韌體的 BMI270 驅動

void setup() {
  Serial.begin(115200);
  imu_init();                               // SPI，CS 在 G46 ⟦s1⟧
  Serial.println("把飛機放平，校正中……"); ⟦s2⟧
  imu_calibrate();                          // 量陀螺儀的零點偏移 ⟦cal⟧
}

void loop() {
  imu_update(); ⟦u⟧
  float roll  = imu_roll();                 // 右側往下為正 ⟦r⟧
  float pitch = imu_pitch();                // 機頭抬起為正 ⟦pt⟧
  Serial.printf("roll %5.1f°  pitch %5.1f°\\n", roll, pitch); ⟦p⟧
  delay(200); ⟦d⟧
}`,
  *run(io) {
    yield { at: 's1', wait: 50 };
    io.print('把飛機放平，校正中……');
    yield { at: 's2', wait: 50 };
    yield { at: 'cal', wait: 800 };
    io.print('校正完成！用遙控器的橫滾／俯仰搖桿，模擬把飛機拿在手上傾斜。');
    for (;;) {
      yield { at: 'u', wait: 5 };
      const s = io.drone!.imu();
      yield { at: 'r', wait: 5 };
      yield { at: 'pt', wait: 5 };
      io.print(`roll ${f1(s.roll).padStart(5)}°  pitch ${f1(s.pitch).padStart(5)}°`);
      yield { at: 'p', wait: 5 };
      yield { at: 'd', wait: 200 };
    }
  },
};

/** 讀遙控器的解鎖請求並回報結果（自穩、定高共用） */
function* handleRc(io: IO, tagArm: string): Generator<{ at: string; wait?: number }, void, void> {
  const d = io.drone!;
  const req = d.take();
  if (req === 'arm') {
    const why = d.arm(true);
    io.print(why ? `✕ 拒絕解鎖：${why}` : '✓ 解鎖！馬達開始轉');
    yield { at: tagArm, wait: 20 };
  } else if (req === 'disarm') {
    const wasFlying = d.state().armed;
    d.arm(false);
    io.print(d.state().landing ? '收到上鎖：先自動降落……' : wasFlying ? '上鎖，馬達停止' : '已經是上鎖狀態');
    yield { at: tagArm, wait: 20 };
  }
}

export const P_SF_FLY: ProgramDef = {
  id: 'sf-fly-rc',
  title: '自穩飛行（遙控器解鎖＋油門）',
  outputs: MOTOR_PINS,
  code: `// 自穩模式：搖桿決定「想要的角度」，飛控負責維持水平
void loop() {                               // 每 2.5 ms 跑一次（400 Hz）
  imu_update();                             // 讀姿態 ⟦imu⟧
  if (rc.armPressed()) {                    // 遙控器按了解鎖 ⟦rc⟧
    // 安全檢查：油門歸零、機身水平、電池夠電才解鎖
    if (throttle < 0.05 && level() && battery_ok()) arm(); ⟦arm⟧
  }
  float roll_ref  = rc.roll  * 25;          // 搖桿 → 想要的角度（度）⟦ref⟧
  float pitch_ref = rc.pitch * 25;
  angle_control(roll_ref, pitch_ref);       // 角度環 → 角速度環 ⟦ctl⟧
  float T = rc.throttle;                    // 油門直接給
  // 混控：把「推力＋三個轉動」分配給四顆馬達 ⟦mix⟧
  FR = T + (-R + P + Y) / 4;   FL = T + ( R + P - Y) / 4;
  RR = T + (-R - P - Y) / 4;   RL = T + ( R - P + Y) / 4;
  motor_write(FL, FR, RL, RR); ⟦out⟧
}`,
  *run(io) {
    const d = io.drone!;
    d.setup({ mode: 'stab' });
    io.print('自穩模式待命：把油門拉到 0，再按遙控器的「解鎖」。');
    let t = 0;
    for (;;) {
      yield { at: 'imu', wait: 8 };
      yield { at: 'rc', wait: 4 };
      yield* handleRc(io, 'arm');
      yield { at: 'ref', wait: 4 };
      yield { at: 'ctl', wait: 4 };
      yield { at: 'mix', wait: 4 };
      yield { at: 'out', wait: 4 };
      t += 28;
      if (t >= 700) {
        t = 0;
        const s = io.drone!.imu();
        const st = d.state();
        if (st.armed) io.print(`高度 ${f1(s.alt)} cm　roll ${f1(s.roll)}°　pitch ${f1(s.pitch)}°　電池 ${s.vbat.toFixed(2)} V`);
        else if (st.flipped) io.print('⚠ 翻覆！傾斜超過 75°，馬達已切斷。檢查槳的方向後重新執行。');
      }
    }
  },
};

export const P_SF_HOVER: ProgramDef = {
  id: 'sf-hover-rc',
  title: '定高懸停：高度 PID',
  outputs: MOTOR_PINS,
  params: [
    { key: 'alt', label: '目標高度（cm）', def: 50, min: 20, max: 55 },
    { key: 'kp', label: 'Kp（×0.01）', def: 50, min: 0, max: 300 },
    { key: 'ki', label: 'Ki（×0.01）', def: 0, min: 0, max: 200 },
    { key: 'kd', label: 'Kd（×0.01）', def: 25, min: 0, max: 100 },
  ],
  code: `// 定高模式：雷射測距量高度，PID 自動調油門
const float TARGET = {{alt}} / 100.0;       // 目標高度（m）⟦s1⟧
const float Kp = {{kp}} * 0.01;
const float Ki = {{ki}} * 0.01;
const float Kd = {{kd}} * 0.01;
const float TRIM = 0.62;                    // 懸停油門的猜測值（滿電時校正）

void loop() {                               // 400 Hz
  float h = tof_bottom();                   // 往下量的高度（m）⟦tof⟧
  if (rc.armPressed()) arm();               // 解鎖後自動起飛 ⟦arm⟧
  float err = TARGET - h;                   // 差多少 ⟦err⟧
  integral += err * dt;                     // 累積誤差
  float T = TRIM + Kp * err                 // P：差越多推越大 ⟦pid⟧
                 + Ki * integral            // I：把長期的偏差補回來
                 - Kd * climb_rate;         // D：上升太快就踩煞車
  angle_control(0, 0);                      // 同時維持水平 ⟦ctl⟧
  mix_and_write(T); ⟦out⟧
}`,
  *run(io, p) {
    const d = io.drone!;
    d.setup({ mode: 'alt', kp: p.kp / 100, ki: p.ki / 100, kd: p.kd / 100, altRef: p.alt / 100 });
    yield { at: 's1', wait: 20 };
    io.print(`定高模式待命：目標 ${p.alt} cm、Kp ${(p.kp / 100).toFixed(2)}、Ki ${(p.ki / 100).toFixed(2)}、Kd ${(p.kd / 100).toFixed(2)}`);
    io.print('按遙控器的「解鎖」會自動起飛；按「上鎖」會先降落。');
    let t = 0;
    for (;;) {
      yield { at: 'tof', wait: 6 };
      yield* handleRc(io, 'arm');
      yield { at: 'err', wait: 4 };
      yield { at: 'pid', wait: 8 };
      yield { at: 'ctl', wait: 4 };
      yield { at: 'out', wait: 4 };
      t += 26;
      if (t >= 600) {
        t = 0;
        const st = d.state();
        const s = d.imu();
        if (st.armed) io.print(`高度 ${f1(s.alt).padStart(5)} cm　誤差 ${f1(p.alt - s.alt).padStart(5)} cm　電池 ${s.vbat.toFixed(2)} V`);
        else if (st.flipped) io.print('⚠ 翻覆！馬達已切斷。');
      }
    }
  },
};

export const P_SF_GROVE: ProgramDef = {
  id: 'sf-grove-rc',
  title: 'Grove 起飛警示燈（G1）',
  outputs: ['GPIO1', ...MOTOR_PINS],
  code: `// PORT.B 的 G1 外接一顆 LED：解鎖時亮，提醒旁邊的人「螺旋槳要轉了」
const int WARN_LED = 1; ⟦s0⟧

void setup() {
  pinMode(WARN_LED, OUTPUT); ⟦s1⟧
}

void loop() {
  if (rc.armPressed())    arm(); ⟦arm⟧
  if (rc.disarmPressed()) disarm();
  digitalWrite(WARN_LED, armed ? HIGH : LOW); ⟦led⟧
  flight_control();                         // 自穩飛行，和上一關相同 ⟦ctl⟧
}`,
  *run(io) {
    const d = io.drone!;
    d.setup({ mode: 'stab' });
    yield { at: 's0' };
    io.pinMode('GPIO1', 'OUTPUT');
    yield { at: 's1' };
    io.print('警示燈待命：按遙控器的「解鎖」試試看。');
    for (;;) {
      yield* handleRc(io, 'arm');
      yield { at: 'arm', wait: 6 };
      io.digitalWrite('GPIO1', d.state().armed ? 1 : 0);
      yield { at: 'led', wait: 6 };
      yield { at: 'ctl', wait: 12 };
    }
  },
};

/** 自由建構的範例（第 2 支是預設） */
export const STAMPFLY_FREE_PROGRAMS: ProgramDef[] = [P_SF_RGB, P_SF_GROVE, P_SF_MOTOR, P_SF_IMU, P_SF_FLY, P_SF_HOVER];
