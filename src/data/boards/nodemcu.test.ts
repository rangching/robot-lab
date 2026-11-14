import { describe, expect, it } from 'vitest';
import { nodemcuData, NM_PINS, NM_W, NM_D } from './nodemcu';
import { unoData } from './registry';
import { NODEMCU_MISSIONS } from '../../features/bench/missionsNodemcu';
import { NODEMCU_FREE_PROGRAMS, P_NM_BLINK, P_NM_WIFI, P_NM_BUTTON } from '../../sim/programsNodemcu';
import { setSimBoard } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Circuit } from '../../sim/circuit';
import { Engine, simVisual } from '../../sim/engine';
import { useWeb } from '../../sim/web';
import type { Comp, Wire } from '../../sim/types';

const ids = NM_PINS.map((p) => p.id);
const w = (a: string, b: string, i = 0): Wire => ({ id: `w${a}${b}${i}`, a, b, color: '#fff' });
const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#0ff' } };
const r220: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const r10k: Comp = { id: 'R2', type: 'resistor', x: 0, z: 0, props: { ohms: 10000 } };
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };

const onNm = (fn: () => void) => () => {
  setSimBoard(nodemcuData);
  try { fn(); } finally { setSimBoard(unoData); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);

/** NodeMCU 的 D 編號 → GPIO 編號（ESP8266 Arduino 核心 nodemcu 變體的定義） */
const D_TO_GPIO: Record<string, number> = { D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, D9: 3, D10: 1 };

describe('NodeMCU（Amica）資料', () => {
  it('30 支腳、id 不重複，D0–D10 共 11 支 GPIO', () => {
    expect(NM_PINS).toHaveLength(30);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => /^D\d+$/.test(id)).sort()).toEqual(Object.keys(D_TO_GPIO).sort());
  });

  it('兩排排針相距 0.9 英吋，都在板子範圍內，對齊 2.54 mm 格點', () => {
    const zs = [...new Set(NM_PINS.map((p) => p.z.toFixed(3)))];
    expect(zs).toHaveLength(2);
    expect(Math.abs(Number(zs[0]) - Number(zs[1]))).toBeCloseTo(2.286, 3);
    for (const p of NM_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(NM_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(NM_D / 2);
      expect((p.x / 0.254) % 1 === 0 || Math.abs(Math.round(p.x / 0.254) - p.x / 0.254) < 1e-6).toBe(true);
    }
  });

  it('板上 LED 是 D4、低電位亮；開機綁腳、無上拉、序列腳都指到存在的腳', () => {
    expect(nodemcuData.ledPin).toBe('D4');
    expect(nodemcuData.ledActiveLow).toBe(true);
    for (const id of [...nodemcuData.strapLow!, ...nodemcuData.noPullup!, ...nodemcuData.serialPins!, ...nodemcuData.gnd, ...nodemcuData.analogOnly]) expect(ids).toContain(id);
    expect(nodemcuData.logicV).toBe(3.3);
  });

  it('零件編號連續，零件都有外框和托盤位置', () => {
    const parts = nodemcuData.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(nodemcuData.footprints[p.id], p.id).toBeDefined();
      expect(nodemcuData.tray[p.id], p.id).toBeDefined();
    }
  });

  it('測驗至少 8 題，題目對應的零件都存在', () => {
    const partIds = new Set(nodemcuData.lesson.parts.map((p) => p.id));
    expect(nodemcuData.lesson.quiz.length).toBeGreaterThanOrEqual(8);
    for (const q of nodemcuData.lesson.quiz) expect(partIds.has(q.part), q.part).toBe(true);
  });

  it('任務與範例程式用到的腳位都存在', () => {
    for (const p of NODEMCU_FREE_PROGRAMS) for (const out of p.outputs) expect(ids).toContain(out);
    for (const m of NODEMCU_MISSIONS) {
      expect(m.board).toBe('nodemcu');
      for (const out of m.program.outputs) expect(ids).toContain(out);
      const src = [m.steps.map((s) => s.check.toString()).join('\n'), JSON.stringify(m.preset ?? {})].join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
  });

  it('範例程式碼一律寫 D 編號常數，不直接寫 GPIO 數字', () => {
    for (const p of NODEMCU_FREE_PROGRAMS) {
      expect(p.code, p.id).not.toMatch(/const int \w+ = \d+;/);
      for (const [, d] of p.code.matchAll(/const int \w+ = (D\d+);/g)) expect(ids, `${p.id}:${d}`).toContain(d);
    }
  });

  it('背面對照表的 GPIO 編號和核心定義一致', () => {
    for (const [d, g] of Object.entries(D_TO_GPIO)) {
      const desc = NM_PINS.find((p) => p.id === d)!.desc;
      expect(desc, d).toContain(`GPIO${g}`);
    }
  });
});

describe('NodeMCU 的 3.3 V 檢查', () => {
  it('四支 GND、三支 3V3 本來就相通', onNm(() => {
    const n = buildNets([], []);
    expect(n.same('mcu:GND1', 'mcu:GND4')).toBe(true);
    expect(n.same('mcu:3V3', 'mcu:3V3C')).toBe(true);
  }));

  it('旋鈕接任何一支 3V3 都讀得到滿格', onNm(() => {
    const ws = [w('K1:1', 'mcu:GND3'), w('K1:2', 'mcu:3V3C'), w('K1:W', 'mcu:A0')];
    expect(codes([pot], ws).filter((c) => c.startsWith('error'))).toEqual([]);
    const c = new Circuit([pot], ws);
    expect(c.analogRead('A0', {}, { ...noInput, pot: { K1: 1 } })).toBe(1023);
  }));

  it('旋鈕接 Vin（5 V）會擋下來', onNm(() => {
    expect(codes([pot], [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:VIN'), w('K1:W', 'mcu:A0')])).toContain('error:overvolt-pot');
  }));

  it('3V3B 短路到 GND 也抓得到', onNm(() => {
    expect(codes([], [w('mcu:3V3B', 'mcu:GND2')])).toContain('error:short');
  }));

  it('按鈕接 D0 會提醒沒有內建上拉；接 D2 不會', onNm(() => {
    expect(codes([btn], [w('mcu:D0', 'B1:1'), w('B1:2', 'mcu:GND1')])).toContain('warn:no-pullup');
    expect(codes([btn], [w('mcu:D2', 'B1:1'), w('B1:2', 'mcu:GND1')])).not.toContain('warn:no-pullup');
  }));

  it('LED 接 D0 可以（D0 能輸出），不會說只能輸入', onNm(() => {
    expect(codes([led, r220], [w('mcu:D0', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')], ['D0'])).not.toContain('warn:input-only');
  }));

  it('D8（GPIO15）被上拉會提醒開機綁腳', onNm(() => {
    expect(codes([r10k], [w('mcu:D8', 'R2:1'), w('R2:2', 'mcu:3V3')])).toContain('warn:strap');
    expect(codes([r10k], [w('mcu:D5', 'R2:1'), w('R2:2', 'mcu:3V3')])).not.toContain('warn:strap');
  }));

  it('LED 接到 flash 腳（SD3）會提醒不能用', onNm(() => {
    expect(codes([led, r220], [w('mcu:SD3', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')])).toContain('warn:nc-pin');
    expect(codes([led, r220], [w('mcu:D5', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')], ['D5'])).not.toContain('warn:nc-pin');
  }));

  it('A0 拿去接 LED 會提醒是純類比腳', onNm(() => {
    const iss = checkCircuit([led, r220], [w('mcu:A0', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')]);
    const a = iss.find((i) => i.code === 'analog-only');
    expect(a).toBeTruthy();
    expect(a!.text).not.toContain('A0–A5');
  }));

  it('序列腳警告用 TX／RX 的名字', onNm(() => {
    const iss = checkCircuit([led, r220], [w('mcu:D10', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')]);
    expect(iss.find((i) => i.code === 'serial-pins')?.text).toContain('TX');
  }));
});

describe('NodeMCU 程式模擬', () => {
  const engine = (comps: Comp[], wires: Wire[], prog = P_NM_BLINK, params: Record<string, number> = { ms: 100 }, log: string[] = [], input = noInput) =>
    new Engine(comps, wires, prog, params, () => input, { serial: (s) => log.push(s), tone: () => {} });

  it('藍燈低電位亮：印「亮（LOW）」時板上燈是亮的', onNm(() => {
    const log: string[] = [];
    const e = engine([], [], P_NM_BLINK, { ms: 200 }, log);
    let litWhenLow = 0;
    let darkWhenHigh = 0;
    for (let t = 0; t < 3000; t += 16) {
      const before = log.length;
      e.tick(16);
      const last = log.slice(before).pop();
      if (last === '亮（LOW）' && simVisual.L > 0.5) litWhenLow++;
      if (last === '滅（HIGH）' && simVisual.L < 0.5) darkWhenHigh++;
    }
    expect(e.obs.blinksL).toBeGreaterThanOrEqual(3);
    expect(litWhenLow).toBeGreaterThan(0);
    expect(darkWhenHigh).toBeGreaterThan(0);
  }));

  it('按鈕任務：按下 D2 的按鈕，D6 的 LED 會亮', onNm(() => {
    const ws = [w('mcu:D2', 'B1:1'), w('B1:2', 'mcu:GND1'), w('mcu:D6', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND2')];
    expect(codes([btn, led, r220], ws, ['D6']).filter((c) => c.startsWith('error'))).toEqual([]);
    const pressed = { ...noInput, pressed: new Set(['B1']) };
    const e = engine([btn, led, r220], ws, P_NM_BUTTON, {}, [], pressed);
    for (let t = 0; t < 3000; t += 16) e.tick(16);
    expect(simVisual.led.L1).toBeGreaterThan(0.5);
    expect(e.obs.pressLit).toBe(true);
  }));

  it('Wi-Fi 程式：連線後印 IP，手機開燈／關燈會改變 D5', onNm(() => {
    const ws = [w('mcu:D5', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND3')];
    const log: string[] = [];
    const e = engine([led, r220], ws, P_NM_WIFI, {}, log);
    for (let t = 0; t < 4000; t += 16) e.tick(16);
    expect(useWeb.getState().ip).toBeTruthy();
    useWeb.getState().request('/on');
    for (let t = 0; t < 400; t += 16) e.tick(16);
    expect(simVisual.led.L1).toBeGreaterThan(0.5);
    useWeb.getState().request('/off');
    for (let t = 0; t < 400; t += 16) e.tick(16);
    expect(simVisual.led.L1).toBe(0);
    expect(useWeb.getState().off).toBe(1);
  }));
});
