import { describe, expect, it } from 'vitest';
import { stampflyData, SF_PINS, SF_W, SF_D } from './stampfly';
import { unoData, BOARD_DATA } from './registry';
import { BOARDS } from './index';
import { STAMPFLY_MISSIONS } from '../../features/bench/missionsStampfly';
import { MISSIONS_BY_BOARD, type Ctx } from '../../features/bench/missions';
import { BADGES } from '../../features/progress/badges';
import { STAMPFLY_FREE_PROGRAMS, P_SF_HOVER, P_SF_MOTOR, P_SF_FLY, P_SF_GROVE } from '../../sim/programsStampfly';
import { freePrograms } from '../../sim/programs';
import { setSimBoard } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Engine } from '../../sim/engine';
import { useDrone } from '../../sim/drone';
import { MOTORS, MOTOR_DIR, MOTOR_SHAFT } from '../../sim/flight';
import { boardVisual } from '../../three/boards/visuals';
import type { Comp, Wire } from '../../sim/types';

const w = (a: string, b: string): Wire => ({ id: `${a}-${b}`, a, b, color: '#fff' });
const lipo: Comp = { id: 'B1', type: 'lipo', x: 0, z: 0, props: {} };
const BAT_OK = [w('B1:P', 'mcu:BAT'), w('B1:N', 'mcu:GND3')];
const props = (dirs: Partial<Record<string, 'cw' | 'ccw'>> = {}) =>
  MOTORS.map((m, i): Comp => ({ id: `Q${i}`, type: 'prop', x: 0, z: 0, props: { dir: dirs[m] ?? MOTOR_DIR[m] } }));
const mount = () => MOTORS.map((m, i) => w(`Q${i}:HUB`, `mcu:${MOTOR_SHAFT[m]}`));
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };

const onFly = (fn: () => void) => () => {
  setSimBoard(stampflyData);
  try { fn(); } finally { setSimBoard(unoData); useDrone.setState({ stick: { thr: 0, roll: 0, pitch: 0, yaw: 0 }, req: null }); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);
const engine = (comps: Comp[], wires: Wire[], prog = P_SF_FLY, params: Record<string, number> = {}) =>
  new Engine(comps, wires, prog, params, () => noInput, { serial: () => {}, tone: () => {} });
const run = (e: Engine, ms: number) => { for (let t = 0; t < ms; t += 16) e.tick(16); };

describe('M5Stamp Fly 資料', () => {
  it('登錄到網站：第 9 塊、解鎖、3.3 V、有 3D 外觀', () => {
    expect(BOARD_DATA.stampfly).toBe(stampflyData);
    const s = BOARDS.find((b) => b.id === 'stampfly')!;
    expect(s.num).toBe(9);
    expect(s.locked).toBe(false);
    expect(stampflyData.logicV).toBe(3.3);
    expect(freePrograms('stampfly')).toBe(STAMPFLY_FREE_PROGRAMS);
    expect(MISSIONS_BY_BOARD.stampfly).toBe(STAMPFLY_MISSIONS);
    expect(boardVisual('stampfly').id).toBe('stampfly');
  });

  it('腳位：兩個 Grove 埠、電池、四個馬達軸；都在機身範圍內', () => {
    const ids = SF_PINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['GPIO1', 'GPIO2', 'GPIO13', 'GPIO15', 'BAT', 'GND3', 'MFL', 'MFR', 'MRL', 'MRR']) expect(ids).toContain(id);
    for (const p of SF_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(SF_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(SF_D / 2);
    }
    // 機頭朝遠方（−z）：FL 在左前
    const fl = SF_PINS.find((p) => p.id === 'MFL')!;
    expect(fl.x).toBeLessThan(0);
    expect(fl.z).toBeLessThan(0);
    // 每支腳都掛在某個零件上
    const parts = new Set(stampflyData.lesson.parts.map((p) => p.id));
    for (const p of SF_PINS) expect(parts.has(boardVisual('stampfly').headerOf(p))).toBe(true);
  });

  it('任務徽章與全制霸徽章都存在', () => {
    STAMPFLY_MISSIONS.forEach((m) => expect(BADGES.some((b) => b.id === m.badge)).toBe(true));
    expect(BADGES.some((b) => b.id === 'stampfly-master')).toBe(true);
    expect(new Set(STAMPFLY_MISSIONS.map((m) => m.id)).size).toBe(STAMPFLY_MISSIONS.length);
  });
});

describe('Stamp Fly 上電前檢查', () => {
  it('電池接對：沒有錯誤', onFly(() => {
    expect(codes([lipo, ...props()], [...BAT_OK, ...mount()], P_SF_FLY.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
  }));
  it('電池接反、短路都擋下', onFly(() => {
    expect(codes([lipo], [w('B1:P', 'mcu:GND3'), w('B1:N', 'mcu:BAT')])).toContain('error:bat-reversed');
    expect(codes([lipo], [w('B1:P', 'mcu:GND1')])).toContain('error:bat-short');
    expect(codes([lipo], [w('B1:P', 'mcu:VIN'), w('B1:N', 'mcu:GND1')])).toContain('error:bat-wrong');
  }));
  it('槳裝反、一顆馬達裝兩支都擋下；少裝提醒', onFly(() => {
    expect(codes([lipo, ...props({ FR: 'cw' })], [...BAT_OK, ...mount()])).toContain('error:prop-dir');
    const extra: Comp = { id: 'Q9', type: 'prop', x: 0, z: 0, props: { dir: 'cw' } };
    expect(codes([lipo, ...props(), extra], [...BAT_OK, ...mount(), w('Q9:HUB', 'mcu:MFL')])).toContain('error:prop-double');
    expect(codes([lipo, ...props()], [...BAT_OK, ...mount().slice(0, 2)])).toContain('warn:prop-missing');
    expect(codes([...props()], [w('Q0:HUB', 'mcu:GPIO1')])).toContain('warn:prop-where');
  }));
  it('沒接電池就跑馬達程式：提醒', onFly(() => {
    expect(codes([], [], P_SF_MOTOR.outputs)).toContain('warn:no-battery');
  }));
  it('Grove 的 5V 接到 G 腳：3.3 V 規則照樣擋下', onFly(() => {
    expect(codes([], [w('mcu:VIN', 'mcu:GPIO2')])).toContain('error:overvolt');
  }));
});

describe('Stamp Fly 模擬', () => {
  it('馬達測試：有電池四顆輪流轉；沒電池一顆都不轉', onFly(() => {
    const e = engine([lipo], BAT_OK, P_SF_MOTOR, { duty: 50 });
    run(e, 7500);
    expect(e.obs.motorsSpun.sort()).toEqual([...MOTORS].sort());
    const n = engine([], [], P_SF_MOTOR, { duty: 50 });
    run(n, 7500);
    expect(n.obs.motorsSpun).toEqual([]);
  }));

  it('自穩：油門沒歸零被拒絕，歸零後解鎖、推油門會離地', onFly(() => {
    const e = engine([lipo, ...props()], [...BAT_OK, ...mount()]);
    run(e, 1200);
    useDrone.setState({ stick: { thr: 0.4, roll: 0, pitch: 0, yaw: 0 }, req: 'arm' });
    run(e, 200);
    expect(e.obs.armRefused).toBe(1);
    useDrone.setState({ stick: { thr: 0, roll: 0, pitch: 0, yaw: 0 }, req: 'arm' });
    run(e, 200);
    expect(e.obs.arms).toBe(1);
    useDrone.setState({ stick: { thr: 0.8, roll: 0, pitch: 0, yaw: 0 } });
    run(e, 2500);
    expect(e.obs.altMax).toBeGreaterThan(10);
    expect(e.obs.flipped).toBe(0);
  }));

  it('定高：Ki = 0 停在目標下方；Ki = 0.6 準確懸停', onFly(() => {
    const ready = [[lipo, ...props()], [...BAT_OK, ...mount()]] as const;
    const pd = engine([...ready[0]], [...ready[1]], P_SF_HOVER, { alt: 50, kp: 50, ki: 0, kd: 25 });
    run(pd, 1200);
    useDrone.setState({ req: 'arm' });
    run(pd, 12000);
    expect(pd.obs.lowHoverMs).toBeGreaterThan(2000);
    expect(pd.obs.hoverMs).toBe(0);

    const pid = engine([...ready[0]], [...ready[1]], P_SF_HOVER, { alt: 50, kp: 50, ki: 60, kd: 25 });
    run(pid, 1200);
    useDrone.setState({ req: 'arm' });
    run(pid, 14000);
    expect(pid.obs.hoverMs).toBeGreaterThan(3000);
  }));

  it('Grove 警示燈：解鎖時 G1 的 LED 亮', onFly(() => {
    const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#f00' } };
    const res: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
    const ws = [...BAT_OK, w('mcu:GPIO1', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND2')];
    expect(codes([lipo, led, res], ws, P_SF_GROVE.outputs).filter((c) => c.startsWith('error'))).toEqual([]);
    const e = engine([lipo, led, res], ws, P_SF_GROVE);
    run(e, 1200);
    expect(e.obs.extLedOn).toBe(0);
    useDrone.setState({ req: 'arm' });
    run(e, 300);
    expect(e.obs.arms).toBe(1);
    expect(e.obs.extLedOn).toBe(1);
  }));

  it('任務 3 的檢查：槳全裝對才過', onFly(() => {
    const m = STAMPFLY_MISSIONS.find((x) => x.id === 'sf3')!;
    const ctx = (comps: Comp[], wires: Wire[]): Ctx => ({ comps, wires, nets: buildNets(comps, wires), running: true, params: {}, acks: [], obs: engine(comps, wires).obs, issues: checkCircuit(comps, wires, P_SF_FLY.outputs) });
    expect(m.steps[2].check(ctx([lipo, ...props()], [...BAT_OK, ...mount()]))).toBe(true);
    expect(m.steps[2].check(ctx([lipo, ...props({ RL: 'cw' })], [...BAT_OK, ...mount()]))).toBe(false);
  }));
});
