import { describe, expect, it } from 'vitest';
import { picoData, PICO_PINS, PICO_W, PICO_D, PICO_GND } from './pico';
import { unoData, BOARD_DATA } from './registry';
import { BOARDS } from './index';
import { PICO_MISSIONS } from '../../features/bench/missionsPico';
import { MISSIONS_BY_BOARD, type Ctx } from '../../features/bench/missions';
import { BADGES } from '../../features/progress/badges';
import { PICO_FREE_PROGRAMS } from '../../sim/programsPico';
import { freePrograms } from '../../sim/programs';
import { setSimBoard, IO_PIN } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Circuit } from '../../sim/circuit';
import { Engine } from '../../sim/engine';
import { highlight } from '../../lib/syntax';
import type { Comp, Wire } from '../../sim/types';

const ids = PICO_PINS.map((p) => p.id);
const w = (a: string, b: string): Wire => ({ id: `${a}-${b}`, a, b, color: '#fff' });
const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#0f0' } };
const res: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const buzz: Comp = { id: 'Z1', type: 'buzzer', x: 0, z: 0, props: {} };
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };

const onPico = (fn: () => void) => () => {
  setSimBoard(picoData);
  try { fn(); } finally { setSimBoard(unoData); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);
const physNum = (id: string) => Number(/第 (\d+) 腳/.exec(PICO_PINS.find((p) => p.id === id)!.desc)![1]);

describe('Raspberry Pi Pico 資料', () => {
  it('40 支腳、id 不重複，26 支 GPIO（GP0–GP22、GP26–GP28）', () => {
    expect(PICO_PINS).toHaveLength(40);
    expect(new Set(ids).size).toBe(ids.length);
    const gp = ids.filter((id) => /^GP\d+$/.test(id)).map((id) => Number(id.slice(2))).sort((a, b) => a - b);
    expect(gp).toEqual([...Array.from({ length: 23 }, (_, i) => i), 26, 27, 28]);
    for (const id of gp) expect(IO_PIN.test(`GP${id}`)).toBe(true);
  });

  it('實體腳號 1–40 各出現一次，而且和官方腳位圖一致', () => {
    const nums = PICO_PINS.map((p) => physNum(p.id)).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(physNum('GP0')).toBe(1);
    expect(physNum('GP15')).toBe(20);
    expect(physNum('GP16')).toBe(21);
    expect(physNum('GP26')).toBe(31);
    expect(physNum('3V3')).toBe(36);
    expect(physNum('VIN')).toBe(40);
    // 8 支 GND 在 3、8、13、18、23、28、33（AGND）、38
    expect(PICO_GND.map(physNum).sort((a, b) => a - b)).toEqual([3, 8, 13, 18, 23, 28, 33, 38]);
  });

  it('兩排相距 0.7 英吋、腳距 0.1 英吋，都在板子範圍內', () => {
    const zs = [...new Set(PICO_PINS.map((p) => p.z.toFixed(3)))];
    expect(zs).toHaveLength(2);
    expect(Math.abs(Number(zs[0]) - Number(zs[1]))).toBeCloseTo(1.778, 3);
    for (const p of PICO_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(PICO_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(PICO_D / 2);
    }
    // 排針中心就是板子中心：麵包板 24 欄（偶數）的孔剛好對齊
    const xs = PICO_PINS.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 6);
  });

  it('登錄到網站：解鎖、3.3 V、板上 LED 在 GP25', () => {
    expect(BOARD_DATA.pico).toBe(picoData);
    expect(BOARDS.find((b) => b.id === 'pico')!.locked).toBe(false);
    expect(picoData.logicV).toBe(3.3);
    expect(picoData.ledPin).toBe('GP25');
    expect(freePrograms('pico')).toBe(PICO_FREE_PROGRAMS);
    expect(MISSIONS_BY_BOARD.pico).toBe(PICO_MISSIONS);
  });

  it('零件編號連續，都有外框和托盤位置；測驗至少 8 題', () => {
    const parts = picoData.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(picoData.footprints[p.id], p.id).toBeDefined();
      expect(picoData.tray[p.id], p.id).toBeDefined();
    }
    const partIds = new Set(parts.map((p) => p.id));
    expect(picoData.lesson.quiz.length).toBeGreaterThanOrEqual(8);
    for (const q of picoData.lesson.quiz) expect(partIds.has(q.part), q.part).toBe(true);
  });

  it('任務、徽章與範例程式用到的腳位都存在', () => {
    for (const p of PICO_FREE_PROGRAMS) for (const out of p.outputs) expect(ids).toContain(out);
    expect(BADGES.some((b) => b.id === 'pico-master')).toBe(true);
    PICO_MISSIONS.forEach((m, i) => {
      expect(m.board).toBe('pico');
      expect(m.num).toBe(i + 1);
      expect(BADGES.some((b) => b.id === m.badge), m.badge).toBe(true);
      const src = [m.steps.map((s) => s.check.toString()).join('\n'), JSON.stringify(m.preset ?? {})].join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    });
  });

  it('MicroPython 程式碼裡 Pin()／ADC()／PWM() 的數字就是 GP 編號', () => {
    for (const p of PICO_FREE_PROGRAMS) {
      for (const [, n] of p.code.matchAll(/(?:Pin|ADC)\((\d+)/g)) {
        if (n === '25') continue; // 板上 LED
        expect(ids, `${p.id}:GP${n}`).toContain(`GP${n}`);
      }
      // 程式裡用到的 GP 腳，模擬時都要宣告成輸出（或是輸入）
      for (const out of p.outputs) expect(p.code).toMatch(new RegExp(`Pin\\(${out.slice(2)}[,)]`));
    }
  });

  it('語法上色認得 # 註解，但不會把 #include 當註解', () => {
    const py = highlight('led.value(1)  # 燈亮');
    expect(JSON.stringify(py)).toContain('tok-c');
    const cpp = highlight('#include <WiFi.h>');
    expect(JSON.stringify(cpp)).not.toContain('tok-c');
  });
});

describe('Pico 的電路檢查', () => {
  it('8 支 GND 相通，VBUS 和 VSYS 相通', onPico(() => {
    const n = buildNets([], []);
    for (const g of PICO_GND) expect(n.same('mcu:GND1', `mcu:${g}`)).toBe(true);
    expect(n.same('mcu:VIN', 'mcu:VSYS')).toBe(true);
  }));

  it('旋鈕接 3V3 讀得到滿格；接 VBUS（5 V）會擋下來', onPico(() => {
    const ok = [w('K1:1', 'mcu:AGND'), w('K1:2', 'mcu:3V3'), w('K1:W', 'mcu:GP26')];
    expect(codes([pot], ok).filter((c) => c.startsWith('error'))).toEqual([]);
    expect(new Circuit([pot], ok).analogRead('GP26', {}, { ...noInput, pot: { K1: 1 } })).toBe(1023);
    expect(codes([pot], [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:VIN'), w('K1:W', 'mcu:GP26')])).toContain('error:overvolt-pot');
    expect(codes([pot], [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:VSYS'), w('K1:W', 'mcu:GP27')])).toContain('error:overvolt-pot');
  }));

  it('VBUS 直接接 GPIO、短路到 GND、和 3V3 互接都會擋下來', onPico(() => {
    expect(codes([], [w('mcu:VIN', 'mcu:GP14')])).toContain('error:overvolt');
    expect(codes([], [w('mcu:VSYS', 'mcu:GND7')])).toContain('error:short');
    expect(codes([], [w('mcu:3V3', 'mcu:AGND')])).toContain('error:short');
    expect(codes([], [w('mcu:VIN', 'mcu:3V3')])).toContain('error:rails');
  }));

  it('GP0／GP1 不和 USB 共用，不會出現序列腳警告', onPico(() => {
    expect(codes([led, res], [w('mcu:GP0', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')], ['GP0'])).not.toContain('warn:serial-pins');
  }));

  it('每支 GPIO 都有內建上拉：按鈕接 GP14 讀得到穩定的 1', onPico(() => {
    const c = new Circuit([btn], [w('mcu:GP14', 'B1:1'), w('B1:2', 'mcu:GND4')]);
    expect(c.digitalRead('GP14', { GP14: { mode: 'INPUT_PULLUP', level: 0 } }, noInput)).toBe(1);
    expect(c.digitalRead('GP14', { GP14: { mode: 'INPUT_PULLUP', level: 0 } }, { ...noInput, pressed: new Set(['B1']) })).toBe(0);
  }));
});

describe('Pico 任務在模擬器裡跑得完', () => {
  const ledPath = [w('mcu:GP15', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND4')];

  function play(id: string, comps: Comp[], wires: Wire[], drive: (t: number, inp: { pressed: Set<string>; pot: Record<string, number>; distance: number }) => void = () => {}) {
    setSimBoard(picoData);
    try {
      const m = PICO_MISSIONS.find((x) => x.id === id)!;
      const inp = { pressed: new Set<string>(), pot: {} as Record<string, number>, distance: 40 };
      const params = Object.fromEntries((m.program.params ?? []).map((p) => [p.key, p.def]));
      const eng = new Engine(comps, wires, m.program, params, () => inp, { serial: () => {}, tone: () => {} });
      for (let t = 0; t < 6000; t += 50) {
        drive(t, inp);
        eng.tick(50);
      }
      const ctx: Ctx = {
        comps, wires, nets: buildNets(comps, wires), running: true, params,
        acks: m.steps.map((_, i) => `${id}-s${i}`), obs: eng.obs, issues: checkCircuit(comps, wires, m.program.outputs),
      };
      return m.steps.map((s) => s.check(ctx));
    } finally {
      setSimBoard(unoData);
    }
  }
  const allTrue = (s: boolean[]) => expect(s).toEqual(s.map(() => true));

  it('pc1：GP25 綠燈閃爍', () => allTrue(play('pc1', [], [])));

  it('pc2：GP14 按鈕點亮 GP15 的 LED', () => {
    allTrue(play('pc2', [btn, led, res], [w('mcu:GP14', 'B1:1'), w('B1:2', 'mcu:GND4'), ...ledPath], (t, inp) => {
      if (t > 2000) inp.pressed.add('B1');
    }));
  });

  it('pc2：LED 接到 GP20（誤以為是第 20 腳）不會過關', () => {
    const s = play('pc2', [btn, led, res], [w('mcu:GP14', 'B1:1'), w('B1:2', 'mcu:GND4'), w('mcu:GP20', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND6')], (t, inp) => {
      if (t > 2000) inp.pressed.add('B1');
    });
    expect(s[1]).toBe(false);
    expect(s.at(-1)).toBe(false);
  });

  it('pc3：GP26 旋鈕調 GP15 亮度（預設接線＋AGND）', () => {
    const m = PICO_MISSIONS.find((x) => x.id === 'pc3')!;
    allTrue(play('pc3', [...m.preset!.comps, pot], [...m.preset!.wires, w('K1:1', 'mcu:3V3'), w('K1:2', 'mcu:AGND'), w('K1:W', 'mcu:GP26')], (t, inp) => {
      inp.pot.K1 = Math.min(1, Math.max(0, (t - 1000) / 3000));
    }));
  });

  it('pc4：GP18 PWM 蜂鳴器播完旋律', () => {
    allTrue(play('pc4', [buzz], [w('mcu:GP18', 'Z1:P'), w('Z1:N', 'mcu:GND7')]));
  });
});
