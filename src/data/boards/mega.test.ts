import { describe, expect, it } from 'vitest';
import { megaData, MEGA_PINS, MEGA_W, MEGA_D } from './mega';
import { MEGA_MISSIONS } from '../../features/bench/missionsMega';
import { BADGES } from '../../features/progress/badges';

describe('Mega 2560 資料', () => {
  const ids = MEGA_PINS.map((p) => p.id);

  it('腳位 id 不重複', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('D0–D53 與 A0–A15 都在', () => {
    for (let i = 0; i <= 53; i++) expect(ids).toContain(`D${i}`);
    for (let i = 0; i <= 15; i++) expect(ids).toContain(`A${i}`);
  });

  it('PWM 腳是 2–13 和 44–46，共 15 支', () => {
    const pwm = MEGA_PINS.filter((p) => p.kind === 'pwm').map((p) => Number(p.id.slice(1))).sort((a, b) => a - b);
    expect(pwm).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46]);
  });

  it('腳位都落在板子範圍內', () => {
    for (const p of MEGA_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(MEGA_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(MEGA_D / 2);
    }
  });

  it('電源、地與板內相通的腳都存在', () => {
    for (const id of [...megaData.supply, ...megaData.gnd, ...megaData.internalNets.flat()]) expect(ids).toContain(id);
  });

  it('零件編號連續，且都有外框和托盤位置', () => {
    const parts = megaData.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(megaData.footprints[p.id], p.id).toBeDefined();
      expect(megaData.tray[p.id], p.id).toBeDefined();
    }
  });

  it('測驗至少 8 題，題目對應的零件都存在', () => {
    const partIds = new Set(megaData.lesson.parts.map((p) => p.id));
    expect(megaData.lesson.quiz.length).toBeGreaterThanOrEqual(8);
    for (const q of megaData.lesson.quiz) expect(partIds.has(q.part), q.part).toBe(true);
  });

  it('全制霸徽章存在', () => {
    expect(BADGES.some((b) => b.id === 'mega-master')).toBe(true);
  });

  it('任務用到的板子腳位都存在', () => {
    for (const m of MEGA_MISSIONS) {
      expect(m.board).toBe('mega');
      expect(BADGES.some((b) => b.id === m.badge), m.badge).toBe(true);
      for (const out of m.program.outputs) expect(ids).toContain(out);
      const src = m.steps.map((s) => s.check.toString()).join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
  });
});

describe('Mega 任務在模擬器裡跑得完', async () => {
  const { setSimBoard } = await import('../../sim/board');
  const { unoData } = await import('./registry');
  const { buildNets } = await import('../../sim/netlist');
  const { checkCircuit } = await import('../../sim/rules');
  const { Engine } = await import('../../sim/engine');
  type Comp = import('../../sim/types').Comp;
  type Wire = import('../../sim/types').Wire;
  type Ctx = import('../../features/bench/missions').Ctx;

  const w = (a: string, b: string): Wire => ({ id: `${a}-${b}`, a, b, color: '#fff' });
  const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#f00' } };
  const res: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
  const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
  const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
  const ledPath = [w('mcu:D44', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND5')];

  /** 跑程式並依序呼叫 drive（每 50 ms 一次），回傳每一步是否通過 */
  function play(id: string, comps: Comp[], wires: Wire[], drive: (t: number, inp: { pressed: Set<string>; pot: Record<string, number>; distance: number }) => void) {
    setSimBoard(megaData);
    try {
      const m = MEGA_MISSIONS.find((x) => x.id === id)!;
      const inp = { pressed: new Set<string>(), pot: {} as Record<string, number>, distance: 40 };
      const eng = new Engine(comps, wires, m.program, {}, () => inp, { serial: () => {}, tone: () => {} });
      for (let t = 0; t < 4000; t += 50) {
        drive(t, inp);
        eng.tick(50);
      }
      const ctx: Ctx = {
        comps, wires, nets: buildNets(comps, wires), running: true, params: {},
        acks: m.steps.map((_, i) => `${id}-s${i}`), obs: eng.obs, issues: checkCircuit(comps, wires, m.program.outputs),
      };
      return m.steps.map((s) => s.check(ctx));
    } finally {
      setSimBoard(unoData);
    }
  }

  it('g2：D22 按鈕控制 D44 的 LED', () => {
    const steps = play('g2', [btn, led, res], [w('mcu:D22', 'B1:1'), w('B1:2', 'mcu:GND4'), ...ledPath], (t, inp) => {
      if (t > 1500) inp.pressed.add('B1');
    });
    expect(steps).toEqual(steps.map(() => true));
  });

  it('g3：A8 旋鈕調 D44 亮度（5V 取自雙排母頂端）', () => {
    const steps = play('g3', [pot, led, res], [w('K1:1', 'mcu:5V_A'), w('K1:2', 'mcu:GND1'), w('K1:W', 'mcu:A8'), ...ledPath], (t, inp) => {
      inp.pot.K1 = Math.min(1, Math.max(0, (t - 1000) / 2500));
    });
    expect(steps).toEqual(steps.map(() => true));
  });

  it('沒接按鈕時 g2 最後一步不會通過', () => {
    const steps = play('g2', [led, res], ledPath, () => {});
    expect(steps.at(-1)).toBe(false);
  });
});
