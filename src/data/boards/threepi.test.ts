import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { threepiData, TP_PINS, TP_W, TP_D, TP_INTERNAL_PINS, TP_LIFT } from './threepi';
import { unoData, BOARD_DATA } from './registry';
import { BOARDS } from './index';
import { THREEPI_MISSIONS } from '../../features/bench/missionsThreepi';
import { MISSIONS_BY_BOARD, type Ctx, type Mission } from '../../features/bench/missions';
import { BADGES } from '../../features/progress/badges';
import { THREEPI_FREE_PROGRAMS, P_TP_BLINK, layoutOf } from '../../sim/programsThreepi';
import { freePrograms, type ProgramDef } from '../../sim/programs';
import { setSimBoard } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Engine } from '../../sim/engine';
import { useBot } from '../../sim/bot';
import { boardVisual } from '../../three/boards/visuals';

const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };
const engine = (prog: ProgramDef, params: Record<string, number> = {}) => {
  const def = Object.fromEntries((prog.params ?? []).map((p) => [p.key, p.def]));
  return new Engine([], [], prog, { ...def, ...params }, () => noInput, { serial: () => {}, tone: () => {} });
};
const run = (e: Engine, ms: number) => { for (let t = 0; t < ms; t += 16) e.tick(16); };
const pressA = () => { useBot.getState().press('A'); useBot.getState().release('A'); };

/** 依任務程式＋參數跑一段時間，回傳某一步的檢查結果 */
function stepPasses(m: Mission, i: number, params: Record<string, number>, ms: number, acks: string[] = []) {
  const prog = m.program;
  const p = { ...Object.fromEntries((prog.params ?? []).map((x) => [x.key, x.def])), ...params };
  const e = engine(prog, p);
  run(e, 1200);
  pressA();
  run(e, ms);
  const ctx: Ctx = { comps: [], wires: [], nets: buildNets([], []), running: true, params: p, acks, obs: e.obs, issues: checkCircuit([], [], prog.outputs) };
  return m.steps[i].check(ctx);
}
const M = (id: string) => THREEPI_MISSIONS.find((m) => m.id === id)!;

beforeEach(() => setSimBoard(threepiData));
afterEach(() => setSimBoard(unoData));

describe('Pololu 3pi+ 2040 資料', () => {
  it('登錄到網站：第 12 塊、解鎖、3.3 V、有 3D 外觀與任務', () => {
    expect(BOARD_DATA.threepi).toBe(threepiData);
    const s = BOARDS.find((b) => b.id === 'threepi')!;
    expect(s.num).toBe(12);
    expect(s.locked).toBe(false);
    expect(threepiData.logicV).toBe(3.3);
    expect(freePrograms('threepi')).toBe(THREEPI_FREE_PROGRAMS);
    expect(MISSIONS_BY_BOARD.threepi).toBe(THREEPI_MISSIONS);
    expect(boardVisual('threepi').id).toBe('threepi');
    expect(boardVisual('threepi').BenchFly).toBeTruthy();
  });

  it('腳位：擴充排針的 4 支空腳＋3V3＋GND，都在圓形板子內；板內腳不重複', () => {
    const ids = TP_PINS.map((p) => p.id);
    expect(ids.sort()).toEqual(['3V3', 'GND', 'GP24', 'GP27', 'GP28', 'GP29']);
    for (const p of TP_PINS) expect(Math.hypot(p.x, p.z)).toBeLessThan(TP_W / 2);
    // 擴充排針在車頭（−z）
    expect(TP_PINS.every((p) => p.z < 0)).toBe(true);
    for (const id of ids) expect(TP_INTERNAL_PINS).not.toContain(id);
    // 官方函式庫的腳位：馬達、編碼器、循線、碰撞、黃燈
    for (const g of ['GP10', 'GP11', 'GP14', 'GP15', 'GP8', 'GP9', 'GP12', 'GP13', 'GP18', 'GP22', 'GP16', 'GP17', 'GP25']) expect(TP_INTERNAL_PINS).toContain(g);
    expect(threepiData.ledPin).toBe('GP25');
    expect(threepiData.ledActiveLow).toBe(true);
  });

  it('零件外框都在板子範圍內；背面有輪子、馬達、循線與碰撞感測器', () => {
    const L = threepiData.lesson;
    for (const p of L.parts) {
      const [x, y] = threepiData.footprints[p.id];
      expect(Math.hypot(x - TP_W * 5, y - TP_D * 5)).toBeLessThan(TP_W * 5);
    }
    const bottom = L.parts.filter((p) => p.side === 'bottom').map((p) => p.id);
    for (const id of ['line', 'bumpL', 'bumpR', 'motorL', 'motorR', 'wheelL', 'wheelR', 'battery', 'caster']) expect(bottom).toContain(id);
    // 組裝托盤只放正面零件
    for (const id of Object.keys(threepiData.tray)) expect(bottom).not.toContain(id);
    expect(threepiData.bench.lift).toBe(TP_LIFT);
  });

  it('任務徽章與全制霸徽章都存在；任務 id 用 tp 前綴', () => {
    THREEPI_MISSIONS.forEach((m) => {
      expect(BADGES.some((b) => b.id === m.badge)).toBe(true);
      expect(m.id).toMatch(/^tp\d$/);
      expect(m.program.id).toMatch(/-bot$/);
    });
    expect(BADGES.some((b) => b.id === 'threepi-master')).toBe(true);
  });

  it('每支程式的高亮標記都在程式碼裡', () => {
    for (const prog of THREEPI_FREE_PROGRAMS) {
      const e = engine(prog);
      const tags = new Set<string>();
      for (let i = 0; i < 400; i++) {
        e.tick(16);
        if (e.tag) tags.add(e.tag);
        if (i === 80) pressA();
      }
      for (const t of tags) expect(prog.code).toContain(`⟦${t}⟧`);
    }
  });
});

describe('3pi+ 模擬（透過 Engine 執行任務程式）', () => {
  it('黃色 LED：低電位點亮，L 燈會閃', () => {
    const e = engine(P_TP_BLINK, { ms: 200 });
    run(e, 3000);
    expect(e.obs.blinksL).toBeGreaterThanOrEqual(3);
    expect(layoutOf(P_TP_BLINK.id)).toBe('open');
  });

  it('沒按 A 之前車子不會動', () => {
    const e = engine(M('tp1').program);
    run(e, 3000);
    expect(useBot.getState().stats?.dist ?? 0).toBeLessThan(0.1);
  });

  it('任務 1：前進再倒車；速度 3000 走得更遠', () => {
    expect(stepPasses(M('tp1'), 2, {}, 1200)).toBe(true);
    expect(stepPasses(M('tp1'), 3, {}, 2500)).toBe(true);
    expect(stepPasses(M('tp1'), 4, { spd: 1500 }, 2500)).toBe(false);
    expect(stepPasses(M('tp1'), 4, { spd: 3000 }, 2500)).toBe(true);
  });

  it('任務 2：預設 200 毫秒轉不到 90°；調到約 300 毫秒剛好；速度加倍轉過頭', () => {
    expect(stepPasses(M('tp2'), 1, {}, 1000)).toBe(true);
    expect(stepPasses(M('tp2'), 2, {}, 1000)).toBe(false);
    const ok = [260, 280, 300, 320, 340].filter((ms) => stepPasses(M('tp2'), 2, { ms }, 1200));
    expect(ok.length).toBeGreaterThan(0);
    expect(stepPasses(M('tp2'), 3, { ms: ok[0], spd: 2000 }, 1200)).toBe(true);
  });

  it('任務 3：編碼器讓車子停在 30、50 cm（誤差 2 cm 內）；速度 5000 會衝過頭', () => {
    expect(stepPasses(M('tp3'), 1, {}, 2500)).toBe(true);
    expect(stepPasses(M('tp3'), 2, { cm: 50 }, 3000)).toBe(true);
    expect(stepPasses(M('tp3'), 3, { cm: 50, spd: 5000 }, 2000)).toBe(true);
  });

  it('任務 4：在障礙場撞 5 次以上、跑 2 公尺，不會卡死', () => {
    expect(stepPasses(M('tp4'), 1, {}, 3000)).toBe(true);
    expect(stepPasses(M('tp4'), 2, {}, 30000)).toBe(true);
  });

  it('任務 5：校正後 P 控制跑完一圈；3000 也不脫軌', () => {
    expect(stepPasses(M('tp5'), 1, {}, 1500)).toBe(true);
    expect(stepPasses(M('tp5'), 2, {}, 10000)).toBe(true);
    expect(stepPasses(M('tp5'), 3, { spd: 3000 }, 7000)).toBe(true);
  });

  it('任務 6：kd = 0 高速會脫軌；kd = 300 連續兩圈不脫軌', () => {
    expect(stepPasses(M('tp6'), 1, {}, 8000)).toBe(true);
    expect(stepPasses(M('tp6'), 2, {}, 8000)).toBe(false);
    expect(stepPasses(M('tp6'), 2, { kd: 300 }, 8000)).toBe(true);
  });
});
