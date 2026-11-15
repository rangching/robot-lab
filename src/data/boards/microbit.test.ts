import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { microbitData, MB_PINS, MB_W, MB_D, EDGE_SLOTS, EDGE_X0, EDGE_PITCH, RINGS, edgeX } from './microbit';
import { unoData, BOARD_DATA } from './registry';
import { BOARDS } from './index';
import { MICROBIT_MISSIONS } from '../../features/bench/missionsMicrobit';
import { MISSIONS_BY_BOARD, type Ctx, type Mission } from '../../features/bench/missions';
import { BADGES } from '../../features/progress/badges';
import { MICROBIT_FREE_PROGRAMS, FRIEND_GROUP } from '../../sim/programsMicrobit';
import { freePrograms } from '../../sim/programs';
import { setSimBoard, IO_PIN } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Engine } from '../../sim/engine';
import { useMb, textColumns, glyph } from '../../sim/microbit';
import { boardVisual } from '../../three/boards/visuals';
import type { Comp, Wire } from '../../sim/types';

const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };
const mb = () => useMb.getState();
const st = () => mb().stats;
const M = (id: string) => MICROBIT_MISSIONS.find((m) => m.id === id)!;

/** 開一台引擎：先等上傳（900 毫秒）跑完 */
function start(m: Mission, params: Record<string, number> = {}, comps: Comp[] = [], wires: Wire[] = []) {
  const p = { ...Object.fromEntries((m.program.params ?? []).map((x) => [x.key, x.def])), ...params };
  const e = new Engine(comps, wires, m.program, p, () => noInput, { serial: () => {}, tone: () => {} });
  const run = (ms: number) => { for (let t = 0; t < ms; t += 16) e.tick(16); };
  run(1000);
  const ctx = (): Ctx => ({ comps, wires, nets: buildNets(comps, wires), running: true, params: p, acks: m.steps.map((_, i) => `${m.id}-s${i}`), obs: e.obs, issues: checkCircuit(comps, wires, m.program.outputs) });
  const pass = (i: number) => m.steps[i].check(ctx());
  return { e, run, pass };
}
const tap = (b: 'A' | 'B') => { mb().press(b); mb().release(b); };
const w = (a: string, b: string): Wire => ({ id: `${a}-${b}`, a, b, color: '#f59e0b' });

beforeEach(() => {
  setSimBoard(microbitData);
  useMb.setState({ tilt: { x: 0, y: 0 }, noise: 30, light: 160, temp: 24, heading: 0 });
});
afterEach(() => setSimBoard(unoData));

describe('BBC micro:bit V2 資料', () => {
  it('登錄到網站：第 11 塊、解鎖、3.3 V、有 3D 外觀與任務', () => {
    expect(BOARD_DATA.microbit).toBe(microbitData);
    const s = BOARDS.find((b) => b.id === 'microbit')!;
    expect(s.num).toBe(11);
    expect(s.locked).toBe(false);
    expect(microbitData.logicV).toBe(3.3);
    expect(freePrograms('microbit')).toBe(MICROBIT_FREE_PROGRAMS);
    expect(MISSIONS_BY_BOARD.microbit).toBe(MICROBIT_MISSIONS);
    expect(boardVisual('microbit').id).toBe('microbit');
    expect(boardVisual('microbit').benchXform).toBeTruthy();
    // 板子編號照順序：Jetson 10、micro:bit 11、3pi+ 12
    expect(BOARDS.map((b) => b.num)).toEqual([...BOARDS.map((b) => b.num)].sort((a, b) => a - b));
  });

  it('邊緣連接器：40 格、5 個圓環各佔 4 格，3V／GND 兩側有窄條，寬度不超出板子', () => {
    expect(EDGE_SLOTS).toHaveLength(40);
    for (const id of RINGS) expect(EDGE_SLOTS.filter((s) => s.id === id && s.ring)).toHaveLength(4);
    expect(EDGE_SLOTS.filter((s) => s.guard).map((s) => s.id)).toEqual(['3V3', '3V3', 'GND', 'GND']);
    expect(EDGE_X0).toBeGreaterThan(0);
    expect(EDGE_X0 * 2 + 40 * EDGE_PITCH).toBeCloseTo(MB_W * 10, 5);
    // 由左到右：3、0、4、5、6、7、1、8–12、2、13–16、3V、19、20、GND
    const order = MB_PINS.slice().sort((a, b) => a.x - b.x).map((p) => p.label);
    expect(order).toEqual(['3', '0', '4', '5', '6', '7', '1', '8', '9', '10', '11', '12', '2', '13', '14', '15', '16', '3V', '19', '20', 'GND']);
  });

  it('腳位：21 支、都在板子內且靠金手指那一側；圓環比窄條更深入板子', () => {
    expect(MB_PINS).toHaveLength(21);
    for (const p of MB_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(MB_W / 2);
      expect(p.z).toBeGreaterThan(MB_D / 2 - 1);
      if (!['3V3', 'GND'].includes(p.id)) expect(IO_PIN.test(p.id), p.id).toBe(true);
    }
    const ring = MB_PINS.find((p) => p.id === 'P0')!;
    const strip = MB_PINS.find((p) => p.id === 'P3')!;
    expect(ring.z).toBeLessThan(strip.z);
    expect(MB_PINS.find((p) => p.id === 'P12')!.kind).toBe('nc');
    expect(edgeX('GND', true)).toBeGreaterThan(edgeX('3V3', true));
  });

  it('零件外框都在板子範圍內；背面有處理器、加速度計、喇叭、麥克風', () => {
    for (const p of microbitData.lesson.parts) {
      const [x, y] = microbitData.footprints[p.id];
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MB_W * 10);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MB_D * 10);
    }
    const bottom = microbitData.lesson.parts.filter((p) => p.side === 'bottom').map((p) => p.id);
    for (const id of ['mcu', 'motion', 'speaker', 'mic']) expect(bottom).toContain(id);
    for (const id of Object.keys(microbitData.tray)) expect(bottom).not.toContain(id);
  });

  it('任務徽章與全制霸徽章都存在；任務 id 用 mb 前綴', () => {
    MICROBIT_MISSIONS.forEach((m) => {
      expect(BADGES.some((b) => b.id === m.badge)).toBe(true);
      expect(m.id).toMatch(/^mb\d$/);
    });
    expect(BADGES.some((b) => b.id === 'microbit-master')).toBe(true);
  });

  it('字型：捲動用到的字都有、每個字 5 欄＋1 欄空白', () => {
    for (const ch of 'HI0123456789C?ABCXYZ') expect(glyph(ch)).toHaveLength(25);
    expect(textColumns('HI')).toHaveLength(12);
  });

  it('每支程式的高亮標記都在程式碼裡（按 A、搖一搖、拍手都會走到）', () => {
    for (const prog of MICROBIT_FREE_PROGRAMS) {
      const e = new Engine([], [], prog, Object.fromEntries((prog.params ?? []).map((p) => [p.key, p.def])), () => noInput, { serial: () => {}, tone: () => {} });
      const tags = new Set<string>();
      for (let i = 0; i < 500; i++) {
        e.tick(16);
        if (e.tag) tags.add(e.tag);
        if (i === 120) { tap('A'); mb().shake(); mb().clap(); }
        if (i === 300) tap('B');
      }
      for (const t of tags) expect(prog.code, `${prog.id} ⟦${t}⟧`).toContain(`⟦${t}⟧`);
    }
  });
});

describe('micro:bit 模擬（透過 Engine 執行任務程式）', () => {
  it('任務 1：HI 捲完；A 笑臉、B 哭臉、摸 logo 愛心', () => {
    const { run, pass } = start(M('mb1'));
    run(500);
    expect(pass(1)).toBe(false);
    run(3500);
    expect(pass(1)).toBe(true);
    tap('A');
    run(200);
    expect(pass(2)).toBe(false);
    tap('B');
    run(200);
    expect(pass(2)).toBe(true);
    mb().press('logo');
    run(200);
    mb().release('logo');
    expect(pass(3)).toBe(true);
  });

  it('任務 2：傾斜到四個邊；搖三次擲出三個 1–6 的點數', () => {
    const { run, pass } = start(M('mb2'));
    for (const [x, y] of [[-1024, 0], [1024, 0], [0, -1024], [0, 1024]]) {
      mb().setTilt(x, y);
      run(200);
    }
    expect(pass(1)).toBe(true);
    mb().setTilt(0, 0);
    for (let i = 0; i < 3; i++) {
      mb().shake();
      run(1800);
    }
    expect(st().rolls).toHaveLength(3);
    st().rolls.forEach((n) => { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(6); });
    expect(pass(2)).toBe(true);
  });

  it('任務 3：鱷魚夾 P0 → 220Ω → LED → GND，按 A 亮、按 B 滅', () => {
    const comps: Comp[] = [
      { id: 'R1', type: 'resistor', x: 1, z: 2, props: { ohms: 220 } },
      { id: 'L1', type: 'led', x: 3, z: 2, props: { color: '#ff3030' } },
    ];
    const wires = [w('mcu:P0', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND')];
    const { e, run, pass } = start(M('mb3'), {}, comps, wires);
    expect(pass(0)).toBe(true);
    expect(pass(1)).toBe(true);
    expect(checkCircuit(comps, wires, ['P0']).filter((i) => i.level === 'error')).toEqual([]);
    tap('A');
    run(200);
    expect(e.obs.extLedOn).toBe(1);
    tap('B');
    run(200);
    expect(pass(2)).toBe(true);
    // LED 接反（短腳接 P0 那側）就不會亮
    const bad = start(M('mb3'), {}, comps, [w('mcu:P0', 'R1:1'), w('R1:2', 'L1:K'), w('L1:A', 'mcu:GND')]);
    tap('A');
    bad.run(200);
    expect(bad.e.obs.extLedOn).toBe(0);
  });

  it('任務 4：安靜時拍兩下開關燈；噪音大會誤觸發；門檻調高就不會', () => {
    const quiet = start(M('mb4'));
    for (let i = 0; i < 2; i++) { mb().clap(); quiet.run(500); }
    expect(st().toggles).toBe(2);
    expect(st().falseToggles).toBe(0);
    expect(mb().micOn).toBe(true);
    expect(quiet.pass(1)).toBe(true);

    useMb.setState({ noise: 120 });
    const noisy = start(M('mb4'));
    noisy.run(4000);
    expect(noisy.pass(2)).toBe(true);

    useMb.setState({ noise: 120 });
    const tuned = start(M('mb4'), { th: 200 });
    tuned.run(3000);
    for (let i = 0; i < 2; i++) { mb().clap(); tuned.run(500); }
    tuned.run(2000);
    expect(st().falseToggles).toBe(0);
    expect(tuned.pass(3)).toBe(true);
  });

  it('任務 5：群組不同收不到（問號）；改成朋友的群組就能猜拳三回合', () => {
    const lonely = start(M('mb5'));
    mb().shake();
    lonely.run(2600);
    expect(st().timeouts).toBe(1);
    expect(st().rounds).toBe(0);
    expect(lonely.pass(1)).toBe(true);

    const pals = start(M('mb5'), { group: FRIEND_GROUP });
    for (let i = 0; i < 3; i++) { mb().shake(); pals.run(2600); }
    expect(st().rounds).toBe(3);
    expect(st().timeouts).toBe(0);
    expect(mb().log.filter((m) => m.from === 'friend')).toHaveLength(3);
    expect(pals.pass(2)).toBe(true);
  });
});
