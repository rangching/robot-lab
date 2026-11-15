import { afterEach, describe, expect, it } from 'vitest';
import { jetsonData, JET_PINS, JET_W, JET_D, JET_IO, physOfJet } from './jetson';
import { BOARDS } from './index';
import { unoData, isPlayable } from './registry';
import { JETSON_MISSIONS } from '../../features/bench/missionsJetson';
import { JETSON_FREE_PROGRAMS, P_JN_BUTTON, P_JN_DETECT, P_JN_LED, P_JN_PWM, P_JN_SERVO, P_JN_TRACK } from '../../sim/programsJetson';
import { IO_PIN, setSimBoard } from '../../sim/board';
import { checkCircuit } from '../../sim/rules';
import { buildNets } from '../../sim/netlist';
import { Engine } from '../../sim/engine';
import { detect, useVision } from '../../sim/vision';
import { BOARD_VISUALS } from '../../three/boards/visuals';
import type { Comp, Wire } from '../../sim/types';

const ids = JET_PINS.map((p) => p.id);
const w = (a: string, b: string, i = 0): Wire => ({ id: `w${a}${b}${i}`, a, b, color: '#fff' });
const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#f00' } };
const r220: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const r10k: Comp = { id: 'R2', type: 'resistor', x: 0, z: 0, props: { ohms: 10000 } };
const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
const servo: Comp = { id: 'S1', type: 'servo', x: 0, z: 0, props: {} };
const psu: Comp = { id: 'P1', type: 'psu', x: 0, z: 0, props: {} };
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };
const hooks = { serial: () => {}, tone: () => {} };

const onJet = (fn: () => void) => () => {
  setSimBoard(jetsonData);
  try { fn(); } finally { setSimBoard(unoData); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);
const LED12 = [w('mcu:PIN12', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND3')];
const SERVO15 = [w('S1:V', 'P1:P'), w('S1:GND', 'P1:N'), w('S1:SIG', 'mcu:PIN15'), w('P1:N', 'mcu:GND3')];

function run(e: Engine, ms: number) {
  for (let t = 0; t < ms; t += 16) e.tick(16);
}

const resetVision = () => {
  useVision.setState({ target: 'person', x: 0.5, auto: false, mode: '15W' });
  useVision.getState().reset();
};
afterEach(resetVision);

describe('Jetson Orin Nano Super 資料', () => {
  it('登錄到網站：第 10 塊、解鎖、3.3 V、有 3D 外觀', () => {
    const s = BOARDS.find((b) => b.id === 'jetson')!;
    expect(s.num).toBe(10);
    expect(s.locked).toBe(false);
    expect(isPlayable('jetson')).toBe(true);
    expect(jetsonData.logicV).toBe(3.3);
    expect(BOARD_VISUALS.jetson).toBeDefined();
  });

  it('40 支腳、id 不重複，28 支訊號腳都用 PIN＋實體腳號', () => {
    expect(JET_PINS).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect(JET_IO).toHaveLength(28);
    for (const id of JET_IO) {
      expect(IO_PIN.test(id), id).toBe(true);
      expect(physOfJet(id)).toBe(Number(id.slice(3)));
    }
  });

  it('電源、GND 的實體腳號和 Raspberry Pi 相容排針一致', () => {
    expect(['3V3', 'VIN', 'VIN2', '3V3b'].map(physOfJet)).toEqual([1, 2, 4, 17]);
    expect(jetsonData.gnd.map(physOfJet)).toEqual([6, 9, 14, 20, 25, 30, 34, 39]);
    // I²C、UART、硬體 PWM 的位置
    expect(JET_PINS.filter((p) => p.kind === 'bus').map((p) => physOfJet(p.id))).toEqual([3, 5, 8, 10, 27, 28]);
    expect(JET_PINS.filter((p) => p.kind === 'pwm').map((p) => physOfJet(p.id))).toEqual([15, 33]);
  });

  it('排針是 2 × 20、間距 2.54 mm，偶數腳在靠觀看者的板邊', () => {
    const zs = [...new Set(JET_PINS.map((p) => p.z.toFixed(3)))];
    expect(zs).toHaveLength(2);
    expect(Math.abs(Number(zs[0]) - Number(zs[1]))).toBeCloseTo(0.254, 3);
    expect(JET_PINS[0].x).toBeCloseTo(JET_PINS[1].x, 5);
    expect(JET_PINS[1].z).toBeGreaterThan(JET_PINS[0].z);
    expect(JET_PINS[39].x - JET_PINS[0].x).toBeCloseTo(19 * 0.254, 4);
    for (const p of JET_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(JET_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(JET_D / 2);
    }
  });

  it('零件編號連續、都有外框；組裝托盤只放正面零件', () => {
    const parts = jetsonData.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(jetsonData.footprints[p.id], p.id).toBeDefined();
      if (p.side === 'bottom') expect(jetsonData.tray[p.id]).toBeUndefined();
      else expect(jetsonData.tray[p.id], p.id).toBeDefined();
    }
  });

  it('任務與範例程式用到的腳位都存在，程式裡的數字就是實體腳號', () => {
    for (const p of JETSON_FREE_PROGRAMS) for (const out of p.outputs) expect(ids).toContain(out);
    for (const m of JETSON_MISSIONS) {
      expect(m.board).toBe('jetson');
      const src = [m.steps.map((s) => s.check.toString()).join('\n'), JSON.stringify(m.preset ?? {})].join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Za-z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
    for (const p of JETSON_FREE_PROGRAMS) {
      for (const [, n] of p.code.matchAll(/GPIO\.(?:setup|output|input|PWM)\((\d+)/g)) expect(ids, `${p.id}:${n}`).toContain(`PIN${n}`);
      for (const out of p.outputs) expect(p.code, p.id).toContain(out.slice(3));
    }
  });
});

describe('Jetson 上電前檢查', () => {
  it('LED 接第 12 腳 → 220Ω → GND：沒有錯誤', onJet(() => {
    expect(codes([led, r220], LED12, P_JN_LED.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
  }));

  it('5V 腳直接接到訊號腳：報錯', onJet(() => {
    expect(codes([], [w('mcu:VIN2', 'mcu:PIN18')], P_JN_BUTTON.outputs)).toContain('error:overvolt');
  }));

  it('兩支 3V3、兩支 5V、八支 GND 各自相通', onJet(() => {
    expect(codes([], [w('mcu:3V3b', 'mcu:GND8')])).toContain('error:short');
    expect(codes([], [w('mcu:VIN2', 'mcu:3V3')])).toContain('error:rails');
  }));

  it('按鈕接地卻沒有上拉電阻：提醒 Jetson 不能用程式開上拉；加了 10kΩ 就沒事', onJet(() => {
    const base = [w('B1:1', 'mcu:PIN18'), w('B1:2', 'mcu:GND5')];
    expect(codes([btn], base, P_JN_BUTTON.outputs)).toContain('warn:no-pullup');
    expect(codes([btn, r10k], [...base, w('R2:1', 'mcu:PIN18'), w('R2:2', 'mcu:3V3')], P_JN_BUTTON.outputs)).not.toContain('warn:no-pullup');
  }));

  it('伺服機外接電源沒共地：報錯；共地後沒有錯誤', onJet(() => {
    const base = SERVO15.slice(0, 3);
    expect(codes([servo, psu], base, P_JN_SERVO.outputs)).toContain('error:no-common-ground');
    expect(codes([servo, psu], SERVO15, P_JN_SERVO.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
  }));
});

describe('Jetson 程式模擬', () => {
  it('LED 程式讓第 12 腳的 LED 閃爍', onJet(() => {
    const e = new Engine([led, r220], LED12, P_JN_LED, { ms: 200 }, () => noInput, hooks);
    run(e, 3000);
    expect(e.obs.extLedOn).toBeGreaterThanOrEqual(3);
  }));

  it('外加 10kΩ 上拉時，沒按讀到 HIGH、按下讀到 LOW', onJet(() => {
    const ws = [...LED12, w('B1:1', 'mcu:PIN18'), w('B1:2', 'mcu:GND5'), w('R2:1', 'mcu:PIN18'), w('R2:2', 'mcu:3V3')];
    const idle = new Engine([led, r220, btn, r10k], ws, P_JN_BUTTON, {}, () => noInput, hooks);
    run(idle, 2000);
    expect(idle.obs.extLedOn).toBe(0);
    const inp = { pressed: new Set<string>(['B1']), pot: {}, distance: 40 };
    const e = new Engine([led, r220, btn, r10k], ws, P_JN_BUTTON, {}, () => inp, hooks);
    run(e, 2000);
    expect(e.obs.pressLit).toBe(true);
  }));

  it('呼吸燈：第 33 腳的 PWM 讓 LED 亮度從暗到亮', onJet(() => {
    const ws = [w('mcu:PIN33', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND7')];
    const e = new Engine([led, r220], ws, P_JN_PWM, {}, () => noInput, hooks);
    run(e, 4000);
    expect(e.obs.ledMin).toBeLessThan(0.1);
    expect(e.obs.ledMax).toBeGreaterThan(0.9);
  }));

  it('伺服機在第 15 腳掃過 0°–180°', onJet(() => {
    const e = new Engine([servo, psu], SERVO15, P_JN_SERVO, { step: 10 }, () => noInput, hooks);
    run(e, 6000);
    expect(e.obs.servoMax).toBeGreaterThan(150);
    expect(e.obs.servoMin).toBeLessThan(30);
  }));

  it('偵測：人、貓都認得；走到畫面邊緣只剩半個身體時信心掉到門檻以下', () => {
    useVision.setState({ target: 'person', x: 0.5 });
    expect(detect(0, 0.5)[0].label).toBe('person');
    useVision.setState({ target: 'cat' });
    expect(detect(0, 0.5)[0].label).toBe('cat');
    useVision.setState({ target: 'person', x: 0.01 });
    expect(detect(0, 0.5)).toEqual([]);
    useVision.setState({ target: null, x: 0.5 });
    expect(detect(0, 0.1)).toEqual([]);
  });

  it('AI 偵測：看到人亮燈、換成貓就熄；MAXN SUPER 的 FPS 比 15W 高', onJet(() => {
    const e = new Engine([led, r220], LED12, P_JN_DETECT, { th: 50 }, () => noInput, hooks);
    run(e, 3500);
    const v = useVision.getState();
    expect(v.cam).toBe(true);
    expect(v.personFrames).toBeGreaterThan(20);
    expect(e.obs.extLedOn).toBe(1);
    const fps15 = v.maxFps;
    useVision.getState().setTarget('cat');
    run(e, 1000);
    expect(useVision.getState().otherFrames).toBeGreaterThan(20);
    expect(e.obs.ledMin).toBe(0);
    useVision.getState().setMode('MAXN');
    run(e, 1000);
    expect(useVision.getState().maxFps).toBeGreaterThan(fps15);
    expect(useVision.getState().modes).toEqual(['15W', 'MAXN']);
  }));

  it('AI 雲台：人自動走動時，伺服機角度跟著人的位置', onJet(() => {
    useVision.getState().setAuto(true);
    const e = new Engine([servo, psu], SERVO15, P_JN_TRACK, { kp: 3 }, () => noInput, hooks);
    run(e, 9000);
    const v = useVision.getState();
    expect(v.trackFrames).toBeGreaterThan(200);
    expect(v.trackGood / v.trackFrames).toBeGreaterThan(0.6);
    expect(v.xMax - v.xMin).toBeGreaterThan(0.5);
    expect(e.obs.servoMax - e.obs.servoMin).toBeGreaterThan(60);
  }));
});

describe('Jetson 任務：照步驟接好線就能全部過關', () => {
  const ctxOf = (m: (typeof JETSON_MISSIONS)[number], comps: Comp[], wires: Wire[], e: Engine) => ({
    comps, wires, nets: buildNets(comps, wires), running: true, params: {}, acks: m.steps.map((_, i) => `${m.id}-s${i}`),
    obs: e.obs, issues: checkCircuit(comps, wires, m.program.outputs),
  });
  const allPass = (id: string, comps: Comp[], wires: Wire[], inp = noInput, ms = 6000, during?: (e: Engine) => void) => onJet(() => {
    const m = JETSON_MISSIONS.find((x) => x.id === id)!;
    const all = [...(m.preset?.comps ?? []), ...comps];
    const ws = [...(m.preset?.wires ?? []), ...wires];
    const e = new Engine(all, ws, m.program, { ms: 200, step: 10, th: 50, kp: 3 }, () => inp, hooks);
    run(e, ms);
    during?.(e);
    const c = ctxOf(m, all, ws, e);
    m.steps.forEach((s, i) => expect(s.check(c), `${id} 第 ${i + 1} 步`).toBe(true));
  });

  it('j1 LED', allPass('j1', [led, r220], LED12));
  it('j2 按鈕＋上拉', allPass('j2', [btn, r10k], [w('B1:1', 'mcu:PIN18'), w('B1:2', 'mcu:GND5'), w('R2:1', 'mcu:PIN18'), w('R2:2', 'mcu:3V3b')], { pressed: new Set(['B1']), pot: {}, distance: 40 }));
  it('j3 AI 偵測', allPass('j3', [], [], noInput, 3000, (e) => {
    useVision.getState().setTarget('bottle');
    run(e, 800);
    useVision.getState().setMode('MAXN');
    run(e, 800);
  }));
  it('j4 AI 雲台', () => {
    useVision.getState().setAuto(true);
    allPass('j4', [servo, psu], SERVO15, noInput, 9000)();
  });
});
