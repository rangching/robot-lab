/**
 * BBC micro:bit V2 的任務程式與自由建構程式（MicroPython：from microbit import *）。
 * 寫法同 programs.ts：顯示用的程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 板上的 LED、按鈕、感測器、喇叭、無線電都在 src/sim/microbit.ts；只有外接零件（鱷魚夾）才透過 io 寫腳位。
 */
import type { IO, ProgramDef } from './programs';
import {
  FRIEND_GROUP, IMAGES, accel, addStat, clear, glyph, heading, isPressed, lightLevel, line, mbStart, parseImage, pitch, playTune,
  radioConfig, radioOn, radioReceive, radioSend, scroll, setFriendReply, setMatrix, show, showChar, stats, temperature, wait, wasGesture, wasLoud, wasPressed,
} from './microbit';

const HEAD = 'from microbit import *\n';

// ---------- 1. 捲動文字、按鈕換表情 ----------
export const P_MB_HELLO: ProgramDef = {
  id: 'mb-hello',
  title: '捲動文字＋按鈕換表情',
  outputs: [],
  code: `${HEAD}
display.scroll("HI")              # 字從右往左捲過去 ⟦sc⟧

while True:                       # 一直重複 ⟦loop⟧
    if button_a.was_pressed():    # 上次問完之後有沒有按過 A？ ⟦a⟧
        display.show(Image.HAPPY) ⟦ha⟧
    elif button_b.was_pressed(): ⟦b⟧
        display.show(Image.SAD) ⟦sa⟧
    elif pin_logo.is_touched():   # V2 的觸控 logo ⟦l⟧
        display.show(Image.HEART) ⟦he⟧
    sleep(50) ⟦d⟧`,
  *run() {
    mbStart();
    yield* scroll('HI', 'sc');
    for (;;) {
      yield* line('loop');
      if (wasPressed('A')) {
        yield* line('a');
        show('HAPPY');
        yield* line('ha');
      } else if (wasPressed('B')) {
        yield* line('b');
        show('SAD');
        yield* line('sa');
      } else if (isPressed('logo')) {
        yield* line('l');
        show('HEART');
        yield* line('he');
      }
      yield* wait(50, 'd');
    }
  },
};

// ---------- 2. 傾斜水平儀＋搖一搖擲骰子 ----------
export const P_MB_LEVEL: ProgramDef = {
  id: 'mb-level',
  title: '傾斜水平儀＋搖一搖擲骰子',
  outputs: [],
  code: `${HEAD}import random

while True:
    x = accelerometer.get_x()     # 左右傾斜（毫 g，約 −1024～1024） ⟦x⟧
    y = accelerometer.get_y()     # 前後傾斜 ⟦y⟧
    col = min(4, max(0, (x + 1024) * 5 // 2048))   # 換算成第幾行（0–4） ⟦c⟧
    row = min(4, max(0, (y + 1024) * 5 // 2048))
    display.clear()
    display.set_pixel(col, row, 9)                 # 亮點滾向比較低的那一邊 ⟦px⟧
    if accelerometer.was_gesture("shake"):         # 搖一搖？ ⟦sh⟧
        display.show(random.randint(1, 6))         # 擲骰子 ⟦roll⟧
        sleep(1500) ⟦hold⟧
    sleep(50) ⟦d⟧`,
  *run() {
    mbStart();
    for (;;) {
      const a = accel();
      yield* line('x');
      yield* line('y');
      const col = Math.min(4, Math.max(0, Math.floor(((a.x + 1024) * 5) / 2048)));
      const row = Math.min(4, Math.max(0, Math.floor(((a.y + 1024) * 5) / 2048)));
      yield* line('c');
      const m = Array(25).fill(0);
      m[row * 5 + col] = 9;
      setMatrix(m);
      const edges = new Set(stats().tiltEdges);
      if (col === 0) edges.add('L');
      if (col === 4) edges.add('R');
      if (row === 0) edges.add('U');
      if (row === 4) edges.add('D');
      if (edges.size !== stats().tiltEdges.length) addStat({ tiltEdges: [...edges] });
      yield* line('px');
      if (wasGesture('shake')) {
        yield* line('sh');
        const n = 1 + Math.floor(Math.random() * 6);
        showChar(String(n));
        addStat({ rolls: [...stats().rolls, n] });
        yield* line('roll');
        yield* wait(1500, 'hold');
      }
      yield* wait(50, 'd');
    }
  },
};

// ---------- 3. 鱷魚夾接外部 LED ----------
export const P_MB_CLIP: ProgramDef = {
  id: 'mb-clip',
  title: '鱷魚夾外接 LED（P0）：A 開、B 關',
  outputs: ['P0'],
  code: `${HEAD}
while True:
    if button_a.was_pressed(): ⟦a⟧
        pin0.write_digital(1)     # P0 輸出 3.3 V：電流流過電阻和 LED ⟦on⟧
        display.show(Image.YES) ⟦y⟧
    elif button_b.was_pressed(): ⟦b⟧
        pin0.write_digital(0)     # P0 變 0 V：燈滅 ⟦off⟧
        display.show(Image.NO) ⟦n⟧
    sleep(20) ⟦d⟧`,
  *run(io: IO) {
    mbStart();
    io.pinMode('P0', 'OUTPUT');
    io.digitalWrite('P0', 0);
    for (;;) {
      if (wasPressed('A')) {
        yield* line('a');
        io.digitalWrite('P0', 1);
        yield* line('on');
        show('YES');
        yield* line('y');
      } else if (wasPressed('B')) {
        yield* line('b');
        io.digitalWrite('P0', 0);
        yield* line('off');
        show('NO');
        yield* line('n');
      }
      yield* wait(20, 'd');
    }
  },
};

// ---------- 4. 拍手開燈 ----------
const FULL = '99999:99999:99999:99999:99999';
export const P_MB_CLAP: ProgramDef = {
  id: 'mb-clap',
  title: '拍手開燈（麥克風＋喇叭）',
  outputs: [],
  params: [{ key: 'th', label: '門檻（0–255）', def: 128, min: 20, max: 250 }],
  code: `${HEAD}import music

microphone.set_threshold(SoundEvent.LOUD, {{th}})   # 多大聲才算「拍手」 ⟦th⟧
lamp = False

while True:
    if microphone.was_event(SoundEvent.LOUD):      # 從安靜變大聲的那一瞬間 ⟦ev⟧
        lamp = not lamp                            # 開 ↔ 關 ⟦tg⟧
        if lamp:
            display.show(Image("${FULL}")) ⟦on⟧
        else:
            display.clear() ⟦off⟧
        music.pitch(880 if lamp else 440, 80)      # 嗶一聲 ⟦bp⟧
    sleep(50) ⟦d⟧`,
  *run(_io, p) {
    mbStart();
    yield* line('th');
    let lamp = false;
    for (;;) {
      const e = wasLoud(p.th);
      if (e.hit) {
        yield* line('ev');
        lamp = !lamp;
        addStat({ toggles: stats().toggles + 1, falseToggles: stats().falseToggles + (e.byClap ? 0 : 1) });
        yield* line('tg');
        if (lamp) {
          setMatrix(parseImage(FULL), 'LAMP');
          yield* line('on');
        } else {
          clear();
          yield* line('off');
        }
        yield* pitch(lamp ? 880 : 440, 80, 'bp');
      }
      yield* wait(50, 'd');
    }
  },
};

// ---------- 5. 無線電猜拳 ----------
const SHAPES: Record<string, string> = {
  R: '00000:09990:99999:99999:09990',
  P: '99999:90009:90009:90009:99999',
  S: '99009:99090:00900:99090:99009',
};
const BEATS: Record<string, string> = { R: 'S', P: 'R', S: 'P' };
const pick = () => 'RPS'[Math.floor(Math.random() * 3)];

export const P_MB_RADIO: ProgramDef = {
  id: 'mb-radio',
  title: '無線電猜拳（搖一搖出拳）',
  outputs: [],
  params: [{ key: 'group', label: '群組（0–255）', def: 1, min: 0, max: 255 }],
  code: `${HEAD}import radio
import random

radio.on() ⟦on⟧
radio.config(group={{group}})     # 兩塊板子的群組要一樣才收得到 ⟦cfg⟧
SHAPES = {"R": Image("${SHAPES.R}"),     # 石頭
          "P": Image("${SHAPES.P}"),     # 布
          "S": Image("${SHAPES.S}")}     # 剪刀
BEATS = {"R": "S", "P": "R", "S": "P"}   # 誰贏誰

while True:
    if accelerometer.was_gesture("shake"): ⟦sh⟧
        mine = random.choice("RPS") ⟦pk⟧
        display.show(SHAPES[mine])
        radio.send(mine)                 # 送出我的拳 ⟦tx⟧
        theirs = None
        start = running_time()
        while theirs is None and running_time() - start < 2000:
            theirs = radio.receive()     # 等對方的拳（最多 2 秒） ⟦rx⟧
        if theirs is None:
            display.show("?")            # 沒收到：對方不在同一個群組？ ⟦to⟧
        elif BEATS[mine] == theirs:
            display.show(Image.HAPPY)    # 贏了 ⟦win⟧
        elif mine == theirs:
            display.show(Image.ASLEEP)   # 平手 ⟦tie⟧
        else:
            display.show(Image.SAD)      # 輸了 ⟦lose⟧
        sleep(1500) ⟦hold⟧
        display.clear()
    sleep(50) ⟦d⟧`,
  *run(_io, p) {
    mbStart();
    radioOn();
    yield* line('on');
    radioConfig(p.group);
    yield* line('cfg');
    setFriendReply(() => pick(), (r) => parseImage(SHAPES[r]));
    for (;;) {
      if (wasGesture('shake')) {
        yield* line('sh');
        const mine = pick();
        setMatrix(parseImage(SHAPES[mine]), `RPS:${mine}`);
        yield* line('pk');
        radioSend(mine);
        yield* line('tx');
        let theirs: string | null = null;
        for (let t = 0; theirs === null && t < 2000; t += 10) {
          theirs = radioReceive();
          if (theirs === null) yield* wait(10, 'rx');
        }
        if (theirs === null) {
          showChar('?');
          addStat({ timeouts: stats().timeouts + 1 });
          yield* line('to');
        } else {
          addStat({ rounds: stats().rounds + 1 });
          if (BEATS[mine] === theirs) { show('HAPPY'); yield* line('win'); }
          else if (mine === theirs) { show('ASLEEP'); yield* line('tie'); }
          else { show('SAD'); yield* line('lose'); }
        }
        yield* wait(1500, 'hold');
        clear();
      }
      yield* wait(50, 'd');
    }
  },
};

// ---------- 自由建構：溫度計 ----------
export const P_MB_THERMO: ProgramDef = {
  id: 'mb-thermo',
  title: '溫度計：按 A 捲動溫度',
  outputs: [],
  code: `${HEAD}
while True:
    if button_a.was_pressed(): ⟦a⟧
        t = temperature()                  # 處理器晶片的溫度（°C） ⟦t⟧
        display.scroll(str(t) + "C") ⟦sc⟧
    sleep(50) ⟦d⟧`,
  *run() {
    mbStart();
    showChar('A');
    for (;;) {
      if (wasPressed('A')) {
        yield* line('a');
        const t = temperature();
        yield* line('t');
        yield* scroll(`${t}C`, 'sc');
        showChar('A');
      }
      yield* wait(50, 'd');
    }
  },
};

// ---------- 自由建構：夜燈 ----------
export const P_MB_NIGHT: ProgramDef = {
  id: 'mb-night',
  title: '夜燈：暗下來就全亮',
  outputs: [],
  params: [{ key: 'th', label: '多暗才亮（0–255）', def: 60, min: 5, max: 250 }],
  code: `${HEAD}
while True:
    level = display.read_light_level()     # 用 LED 反過來量光：0 暗、255 亮 ⟦r⟧
    if level < {{th}}: ⟦if⟧
        display.show(Image("${FULL}")) ⟦on⟧
    else:
        display.show(Image.ASLEEP)          # 天亮了，休息 ⟦off⟧
    sleep(200) ⟦d⟧`,
  *run(_io, p) {
    mbStart();
    for (;;) {
      const lv = lightLevel();
      yield* line('r');
      yield* line('if');
      if (lv < p.th) { setMatrix(parseImage(FULL), 'LAMP'); yield* line('on'); }
      else { show('ASLEEP'); yield* line('off'); }
      yield* wait(200, 'd');
    }
  },
};

// ---------- 自由建構：指南針 ----------
export const P_MB_COMPASS: ProgramDef = {
  id: 'mb-compass',
  title: '電子指南針：顯示 N／E／S／W',
  outputs: [],
  code: `${HEAD}
compass.calibrate()       # 真的板子第一次會要你傾斜板子、把畫面點滿來校正 ⟦cal⟧

while True:
    h = compass.heading() # 0–359 度，0 是北方 ⟦h⟧
    if h < 45 or h >= 315:
        display.show("N") ⟦n⟧
    elif h < 135:
        display.show("E") ⟦e⟧
    elif h < 225:
        display.show("S") ⟦s⟧
    else:
        display.show("W") ⟦w⟧
    sleep(100) ⟦d⟧`,
  *run() {
    mbStart();
    yield* wait(300, 'cal');
    for (;;) {
      const h = heading();
      yield* line('h');
      const d = h < 45 || h >= 315 ? 'N' : h < 135 ? 'E' : h < 225 ? 'S' : 'W';
      showChar(d);
      yield* line(d.toLowerCase());
      yield* wait(100, 'd');
    }
  },
};

// ---------- 自由建構：喇叭演奏 ----------
const TUNE = ['C4:2', 'E4:2', 'G4:2', 'C5:4', 'R:2', 'G4:2', 'C5:6'];
export const P_MB_MUSIC: ProgramDef = {
  id: 'mb-music',
  title: '內建喇叭：按 A 演奏',
  outputs: [],
  code: `${HEAD}import music

tune = ${JSON.stringify(TUNE).replace(/,/g, ', ')}   # 音名＋八度：拍數 ⟦t⟧

while True:
    if button_a.was_pressed(): ⟦a⟧
        display.show(Image.HAPPY)
        music.play(tune)          # V2：喇叭和 P0 同時出聲 ⟦pl⟧
        display.clear()
    sleep(50) ⟦d⟧`,
  *run() {
    mbStart();
    yield* line('t');
    for (;;) {
      if (wasPressed('A')) {
        yield* line('a');
        show('HAPPY');
        yield* playTune(TUNE, 'pl');
        clear();
      }
      yield* wait(50, 'd');
    }
  },
};

export const MICROBIT_FREE_PROGRAMS: ProgramDef[] = [P_MB_HELLO, P_MB_LEVEL, P_MB_CLIP, P_MB_CLAP, P_MB_RADIO, P_MB_THERMO, P_MB_NIGHT, P_MB_COMPASS, P_MB_MUSIC];

// 測試與面板用
export { FRIEND_GROUP, IMAGES, glyph };
