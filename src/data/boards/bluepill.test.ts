import { describe, expect, it } from 'vitest';
import { bluepillData, BP_PINS, BP_W, BP_D, BP_FT } from './bluepill';
import { BLUEPILL_MISSIONS } from '../../features/bench/missionsBluepill';
import { BADGES } from '../../features/progress/badges';
import { IO_PIN, setSimBoard } from '../../sim/board';
import { unoData } from './registry';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Engine } from '../../sim/engine';
import type { Comp, Wire } from '../../sim/types';
import type { Ctx } from '../../features/bench/missions';

describe('Blue Pill 資料', () => {
  const ids = BP_PINS.map((p) => p.id);

  it('40 支腳、id 不重複', () => {
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('PA0–PA12、PA15、PB0、PB1、PB3–PB15、PC13–PC15 都在，而且模擬器認得', () => {
    const want = [
      ...Array.from({ length: 13 }, (_, i) => `PA${i}`), 'PA15',
      'PB0', 'PB1', ...Array.from({ length: 13 }, (_, i) => `PB${i + 3}`),
      'PC13', 'PC14', 'PC15',
    ];
    for (const p of want) {
      expect(ids, p).toContain(p);
      expect(IO_PIN.test(p), p).toBe(true);
    }
  });

  it('FT 腳都存在，類比腳不是 FT', () => {
    for (const p of BP_FT) expect(ids).toContain(p);
    for (const p of BP_PINS.filter((x) => x.kind === 'analog')) expect(BP_FT).not.toContain(p.id);
  });

  it('腳位都落在板子範圍內', () => {
    for (const p of BP_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(BP_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(BP_D / 2);
    }
  });

  it('零件編號連續，且都有外框和托盤位置', () => {
    const parts = bluepillData.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(bluepillData.footprints[p.id], p.id).toBeDefined();
      expect(bluepillData.tray[p.id], p.id).toBeDefined();
    }
  });

  it('任務的徽章、程式腳位與檢查腳位都存在', () => {
    expect(BADGES.some((b) => b.id === 'bluepill-master')).toBe(true);
    for (const m of BLUEPILL_MISSIONS) {
      expect(m.board).toBe('bluepill');
      expect(BADGES.some((b) => b.id === m.badge), m.badge).toBe(true);
      for (const out of m.program.outputs) expect(ids).toContain(out);
      const src = m.steps.map((s) => s.check.toString()).join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Za-z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
  });
});

describe('Blue Pill 在模擬器裡', () => {
  const w = (a: string, b: string): Wire => ({ id: `${a}-${b}`, a, b, color: '#fff' });
  const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#0f0' } };
  const res: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
  const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
  const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
  const sonar: Comp = { id: 'S1', type: 'hcsr04', x: 0, z: 0, props: {} };
  const ledPath = [w('mcu:PA8', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')];

  function withBoard<T>(f: () => T): T {
    setSimBoard(bluepillData);
    try {
      return f();
    } finally {
      setSimBoard(unoData);
    }
  }

  type Inp = { pressed: Set<string>; pot: Record<string, number>; distance: number };
  function play(id: string, comps: Comp[], wires: Wire[], drive: (t: number, inp: Inp) => void) {
    return withBoard(() => {
      const m = BLUEPILL_MISSIONS.find((x) => x.id === id)!;
      const inp: Inp = { pressed: new Set<string>(), pot: {}, distance: 40 };
      const eng = new Engine(comps, wires, m.program, { ms: 200 }, () => inp, { serial: () => {}, tone: () => {} });
      for (let t = 0; t < 5000; t += 20) {
        drive(t, inp);
        eng.tick(20);
      }
      const ctx: Ctx = {
        comps, wires, nets: buildNets(comps, wires), running: true, params: {},
        acks: m.steps.map((_, i) => `${id}-s${i}`), obs: eng.obs, issues: checkCircuit(comps, wires, m.program.outputs),
      };
      return m.steps.map((s) => s.check(ctx));
    });
  }
  const allTrue = (s: boolean[]) => expect(s).toEqual(s.map(() => true));

  it('bp1：PC13 寫 LOW 才亮，閃得起來', () => {
    allTrue(play('bp1', [], [], () => {}));
  });

  it('bp2：PA0 旋鈕調 PA8 亮度', () => {
    allTrue(play('bp2', [pot, led, res], [w('K1:1', 'mcu:3V3b'), w('K1:2', 'mcu:GND2'), w('K1:W', 'mcu:PA0'), ...ledPath], (t, inp) => {
      inp.pot.K1 = Math.min(1, Math.max(0, (t - 1000) / 3000));
    }));
  });

  it('bp2：旋鈕接 5V 會被擋下', () => {
    const iss = withBoard(() => checkCircuit([pot], [w('K1:1', 'mcu:5V'), w('K1:2', 'mcu:GND2'), w('K1:W', 'mcu:PA0')], ['PA8']));
    expect(iss.some((i) => i.code === 'overvolt-pot' && i.level === 'error')).toBe(true);
  });

  it('bp3：ECHO 接 FT 腳 PB9 不報錯，也量得到距離', () => {
    const wires = [w('S1:VCC', 'mcu:5V'), w('S1:GND', 'mcu:GND1'), w('S1:TRIG', 'mcu:PB8'), w('S1:ECHO', 'mcu:PB9')];
    allTrue(play('bp3', [sonar], wires, (t, inp) => {
      inp.distance = 10 + t / 100;
    }));
    const iss = withBoard(() => checkCircuit([sonar], wires, ['PB8']));
    expect(iss.filter((i) => i.code === 'echo-5v' || i.code === 'overvolt')).toEqual([]);
  });

  it('bp3：ECHO 改接非 FT 的 PA1 會警告', () => {
    const iss = withBoard(() => checkCircuit([sonar], [w('S1:VCC', 'mcu:5V'), w('S1:GND', 'mcu:GND1'), w('S1:TRIG', 'mcu:PB8'), w('S1:ECHO', 'mcu:PA1')], ['PB8']));
    expect(iss.some((i) => i.code === 'echo-5v')).toBe(true);
  });

  it('5V 直接接到非 FT 腳是錯誤，接到 FT 腳不算', () => {
    const bad = withBoard(() => checkCircuit([], [w('mcu:5V', 'mcu:PA3')], []));
    expect(bad.some((i) => i.code === 'overvolt')).toBe(true);
    const good = withBoard(() => checkCircuit([], [w('mcu:5V', 'mcu:PB10')], []));
    expect(good.some((i) => i.code === 'overvolt')).toBe(false);
  });

  it('bp4：按 3 下，PA8 的燈亮 → 滅 → 亮', () => {
    const wires = [...ledPath, w('B1:1', 'mcu:PB12'), w('B1:2', 'mcu:GND3')];
    allTrue(play('bp4', [btn, led, res], wires, (t, inp) => {
      const pressing = [1000, 2000, 3000].some((s) => t >= s && t < s + 300);
      if (pressing) inp.pressed.add('B1');
      else inp.pressed.delete('B1');
    }));
  });

  it('沒接按鈕時 bp4 最後一步不會通過', () => {
    expect(play('bp4', [led, res], ledPath, () => {}).at(-1)).toBe(false);
  });
});
