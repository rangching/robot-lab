import { describe, expect, it } from 'vitest';
import { rpi4Data, RPI_PINS, RPI_W, RPI_D, physOf } from './rpi4';
import { unoData } from './registry';
import { RPI4_MISSIONS } from '../../features/bench/missionsRpi4';
import { RPI4_FREE_PROGRAMS, P_PI_BUTTON, P_PI_FLASK, P_PI_LED, P_PI_SERVO } from '../../sim/programsRpi4';
import { IO_PIN, setSimBoard } from '../../sim/board';
import { checkCircuit } from '../../sim/rules';
import { buildNets } from '../../sim/netlist';
import { Engine } from '../../sim/engine';
import { useWeb } from '../../sim/web';
import type { Comp, Wire } from '../../sim/types';

const ids = RPI_PINS.map((p) => p.id);
const w = (a: string, b: string, i = 0): Wire => ({ id: `w${a}${b}${i}`, a, b, color: '#fff' });
const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#f00' } };
const r220: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
const servo: Comp = { id: 'S1', type: 'servo', x: 0, z: 0, props: {} };
const psu: Comp = { id: 'P1', type: 'psu', x: 0, z: 0, props: {} };
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };

const onPi = (fn: () => void) => () => {
  setSimBoard(rpi4Data);
  try { fn(); } finally { setSimBoard(unoData); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);
const LED17 = [w('mcu:GPIO17', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND2')];

function run(e: Engine, ms: number) {
  for (let t = 0; t < ms; t += 16) e.tick(16);
}

describe('Raspberry Pi 4 資料', () => {
  it('40 支腳、id 不重複，26 支可用 GPIO＋2 支保留腳', () => {
    expect(RPI_PINS).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    const gpio = ids.filter((id) => IO_PIN.test(id));
    expect(gpio).toHaveLength(28);
    expect(RPI_PINS.filter((p) => IO_PIN.test(p.id) && p.kind !== 'nc')).toHaveLength(26);
  });

  it('實體腳號與 BCM 編號對得上', () => {
    const expected: Record<string, number> = { '3V3': 1, VIN: 2, GPIO2: 3, GPIO3: 5, GPIO14: 8, GPIO17: 11, GPIO18: 12, GPIO27: 13, '3V3b': 17, GPIO10: 19, GPIO0: 27, GPIO12: 32, GPIO19: 35, GPIO21: 40 };
    for (const [id, n] of Object.entries(expected)) expect(physOf(id), id).toBe(n);
    expect(rpi4Data.gnd.map(physOf)).toEqual([6, 9, 14, 20, 25, 30, 34, 39]);
  });

  it('排針是 2 × 20、間距 2.54 mm，第 1 腳在左邊內側', () => {
    const zs = [...new Set(RPI_PINS.map((p) => p.z.toFixed(3)))];
    expect(zs).toHaveLength(2);
    expect(Math.abs(Number(zs[0]) - Number(zs[1]))).toBeCloseTo(0.254, 3);
    const p1 = RPI_PINS[0];
    const p2 = RPI_PINS[1];
    expect(p1.x).toBeCloseTo(p2.x, 5);
    expect(p1.z).toBeGreaterThan(p2.z); // 奇數腳離板邊遠（較靠近板子中心）
    expect(RPI_PINS[39].x - p1.x).toBeCloseTo(19 * 0.254, 4);
    for (const p of RPI_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(RPI_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(RPI_D / 2);
    }
  });

  it('零件編號連續、都有外框；組裝托盤只放正面零件', () => {
    const parts = rpi4Data.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(rpi4Data.footprints[p.id], p.id).toBeDefined();
      if (p.side === 'bottom') expect(rpi4Data.tray[p.id]).toBeUndefined();
      else expect(rpi4Data.tray[p.id], p.id).toBeDefined();
    }
  });

  it('任務與範例程式用到的腳位都存在，程式裡的數字是 BCM 編號', () => {
    for (const p of RPI4_FREE_PROGRAMS) for (const out of p.outputs) expect(ids).toContain(out);
    for (const m of RPI4_MISSIONS) {
      expect(m.board).toBe('rpi4');
      const src = [m.steps.map((s) => s.check.toString()).join('\n'), JSON.stringify(m.preset ?? {})].join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Za-z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
    for (const p of RPI4_FREE_PROGRAMS) {
      for (const [, n] of p.code.matchAll(/(?:LED|Button|Servo|Buzzer)\((\d+)/g)) expect(ids, `${p.id}:${n}`).toContain(`GPIO${n}`);
    }
  });
});

describe('Raspberry Pi 4 上電前檢查', () => {
  it('LED 接 GPIO17 → 220Ω → GND：沒有錯誤', onPi(() => {
    expect(codes([led, r220], LED17, P_PI_LED.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
  }));

  it('5V 腳直接接到 GPIO：報錯', onPi(() => {
    expect(codes([], [w('mcu:VIN2', 'mcu:GPIO27')], P_PI_BUTTON.outputs)).toContain('error:overvolt');
  }));

  it('旋鈕一端接 5V、中間腳接 GPIO：報錯', onPi(() => {
    expect(codes([pot], [w('K1:1', 'mcu:VIN'), w('K1:2', 'mcu:GND1'), w('K1:W', 'mcu:GPIO22')])).toContain('error:overvolt-pot');
  }));

  it('兩支 3V3、兩支 5V、八支 GND 各自相通', onPi(() => {
    expect(codes([], [w('mcu:3V3b', 'mcu:GND8')])).toContain('error:short');
    expect(codes([], [w('mcu:VIN2', 'mcu:3V3')])).toContain('error:rails');
  }));

  it('序列埠腳接東西不會出現「上傳失敗」警告', onPi(() => {
    expect(codes([led, r220], [w('mcu:GPIO14', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')], ['GPIO14'])).not.toContain('warn:serial-pins');
  }));

  it('伺服機外接電源沒共地：報錯；共地後沒有錯誤', onPi(() => {
    const base = [w('S1:V', 'P1:P'), w('S1:GND', 'P1:N'), w('S1:SIG', 'mcu:GPIO18')];
    expect(codes([servo, psu], base, P_PI_SERVO.outputs)).toContain('error:no-common-ground');
    expect(codes([servo, psu], [...base, w('P1:N', 'mcu:GND3')], P_PI_SERVO.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
  }));
});

describe('Raspberry Pi 4 程式模擬', () => {
  const hooks = { serial: () => {}, tone: () => {} };

  it('LED 程式讓 GPIO17 的 LED 閃爍', onPi(() => {
    const e = new Engine([led, r220], LED17, P_PI_LED, { ms: 200 }, () => noInput, hooks);
    run(e, 3000);
    expect(e.obs.extLedOn).toBeGreaterThanOrEqual(3);
  }));

  it('按鈕接 GPIO27 和 GND，按下時 LED 亮', onPi(() => {
    const inp = { pressed: new Set<string>(['B1']), pot: {}, distance: 40 };
    const e = new Engine([led, r220, btn], [...LED17, w('B1:1', 'mcu:GPIO27'), w('B1:2', 'mcu:GND3')], P_PI_BUTTON, {}, () => inp, hooks);
    run(e, 2000);
    expect(e.obs.pressLit).toBe(true);
  }));

  it('伺服機在 GPIO18 掃過 0°–180°', onPi(() => {
    const ws = [w('S1:V', 'P1:P'), w('S1:GND', 'P1:N'), w('S1:SIG', 'mcu:GPIO18'), w('P1:N', 'mcu:GND3')];
    const e = new Engine([servo, psu], ws, P_PI_SERVO, { step: 10 }, () => noInput, hooks);
    run(e, 6000);
    expect(e.obs.servoMax).toBeGreaterThan(150);
    expect(e.obs.servoMin).toBeLessThan(30);
  }));

  it('Flask：手機送出 /on、/off，LED 跟著開關', onPi(() => {
    const e = new Engine([led, r220], LED17, P_PI_FLASK, {}, () => noInput, hooks);
    run(e, 2000);
    expect(useWeb.getState().ip).toContain(':5000');
    useWeb.getState().request('/on');
    run(e, 500);
    expect(useWeb.getState().on).toBe(1);
    expect(e.obs.extLedOn).toBeGreaterThanOrEqual(1);
    useWeb.getState().request('/off');
    run(e, 500);
    expect(useWeb.getState().off).toBe(1);
    expect(useWeb.getState().led).toBe(false);
  }));
});

describe('Raspberry Pi 4 任務：照步驟接好線就能全部過關', () => {
  const hooks = { serial: () => {}, tone: () => {} };
  const ctxOf = (m: (typeof RPI4_MISSIONS)[number], comps: Comp[], wires: Wire[], e: Engine) => ({
    comps, wires, nets: buildNets(comps, wires), running: true, params: {}, acks: m.steps.map((_, i) => `${m.id}-s${i}`),
    obs: e.obs, issues: checkCircuit(comps, wires, m.program.outputs),
  });
  const allPass = (id: string, comps: Comp[], wires: Wire[], inp = noInput, ms = 6000, params: Record<string, number> = { ms: 200, step: 10 }) => onPi(() => {
    const m = RPI4_MISSIONS.find((x) => x.id === id)!;
    const all = [...(m.preset?.comps ?? []), ...comps];
    const ws = [...(m.preset?.wires ?? []), ...wires];
    const e = new Engine(all, ws, m.program, params, () => inp, hooks);
    run(e, ms);
    if (id === 'r4') {
      useWeb.getState().request('/on');
      run(e, 400);
      useWeb.getState().request('/off');
      run(e, 400);
    }
    const c = ctxOf(m, all, ws, e);
    m.steps.forEach((s, i) => expect(s.check(c), `${id} 第 ${i + 1} 步`).toBe(true));
  });

  it('r1 LED', allPass('r1', [{ ...led, id: 'L1' }, r220], LED17));
  it('r2 按鈕', allPass('r2', [btn], [w('B1:1', 'mcu:GPIO27'), w('B1:2', 'mcu:GND3')], { pressed: new Set(['B1']), pot: {}, distance: 40 }));
  it('r3 伺服機', allPass('r3', [servo, psu], [w('S1:V', 'P1:P'), w('S1:GND', 'P1:N'), w('S1:SIG', 'mcu:GPIO18'), w('P1:N', 'mcu:GND3')]));
  it('r4 Flask', allPass('r4', [], [], noInput, 2000));
});
