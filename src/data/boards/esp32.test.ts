import { describe, expect, it } from 'vitest';
import { esp32Data, ESP_PINS, ESP_W, ESP_D, ESP_INPUT_ONLY } from './esp32';
import { unoData } from './registry';
import { ESP32_MISSIONS } from '../../features/bench/missionsEsp32';
import { ESP32_FREE_PROGRAMS, P_ESP_BLINK, P_ESP_WIFI } from '../../sim/programsEsp32';
import { setSimBoard } from '../../sim/board';
import { buildNets } from '../../sim/netlist';
import { checkCircuit } from '../../sim/rules';
import { Circuit } from '../../sim/circuit';
import { Engine, simVisual } from '../../sim/engine';
import { useWeb } from '../../sim/web';
import type { Comp, Wire } from '../../sim/types';

const ids = ESP_PINS.map((p) => p.id);
const w = (a: string, b: string, i = 0): Wire => ({ id: `w${a}${b}${i}`, a, b, color: '#fff' });
const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
const btn: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#0ff' } };
const r220: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const r10k: Comp = { id: 'R2', type: 'resistor', x: 0, z: 0, props: { ohms: 10000 } };
const sonar: Comp = { id: 'U1', type: 'hcsr04', x: 0, z: 0, props: {} };
const noInput = { pressed: new Set<string>(), pot: {}, distance: 40 };

const onEsp = (fn: () => void) => () => {
  setSimBoard(esp32Data);
  try { fn(); } finally { setSimBoard(unoData); }
};
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);

describe('ESP32 DevKit V1 資料', () => {
  it('30 支腳、id 不重複，25 支 GPIO', () => {
    expect(ESP_PINS).toHaveLength(30);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => /^D\d+$/.test(id))).toHaveLength(25);
  });

  it('兩排排針相距 1 英吋，都在板子範圍內', () => {
    const zs = [...new Set(ESP_PINS.map((p) => p.z.toFixed(3)))];
    expect(zs).toHaveLength(2);
    expect(Math.abs(Number(zs[0]) - Number(zs[1]))).toBeCloseTo(2.54, 3);
    for (const p of ESP_PINS) {
      expect(Math.abs(p.x)).toBeLessThan(ESP_W / 2);
      expect(Math.abs(p.z)).toBeLessThan(ESP_D / 2);
    }
  });

  it('板上 LED、只能輸入、開機綁腳、序列腳都指到存在的腳', () => {
    for (const id of [esp32Data.ledPin!, ...ESP_INPUT_ONLY, ...esp32Data.strapLow!, ...esp32Data.serialPins!, ...esp32Data.gnd]) expect(ids).toContain(id);
    expect(esp32Data.logicV).toBe(3.3);
  });

  it('零件編號連續，正面零件都有外框和托盤位置', () => {
    const parts = esp32Data.lesson.parts;
    parts.forEach((p, i) => expect(p.num).toBe(i + 1));
    for (const p of parts) {
      expect(esp32Data.footprints[p.id], p.id).toBeDefined();
      expect(esp32Data.tray[p.id], p.id).toBeDefined();
    }
  });

  it('測驗至少 8 題，題目對應的零件都存在', () => {
    const partIds = new Set(esp32Data.lesson.parts.map((p) => p.id));
    expect(esp32Data.lesson.quiz.length).toBeGreaterThanOrEqual(8);
    for (const q of esp32Data.lesson.quiz) expect(partIds.has(q.part), q.part).toBe(true);
  });

  it('任務與範例程式用到的腳位都存在', () => {
    for (const p of ESP32_FREE_PROGRAMS) for (const out of p.outputs) expect(ids).toContain(out);
    for (const m of ESP32_MISSIONS) {
      expect(m.board).toBe('esp32');
      for (const out of m.program.outputs) expect(ids).toContain(out);
      const src = [m.steps.map((s) => s.check.toString()).join('\n'), JSON.stringify(m.preset ?? {})].join('\n');
      for (const [, pin] of src.matchAll(/mcu:([A-Z0-9_]+)/g)) expect(ids, pin).toContain(pin);
    }
  });

  it('範例程式碼裡寫的腳位數字就是 GPIO 編號', () => {
    for (const p of ESP32_FREE_PROGRAMS) {
      for (const [, n] of p.code.matchAll(/const int \w+ = (\d+);/g)) expect(ids, `${p.id}:${n}`).toContain(`D${n}`);
    }
  });
});

describe('ESP32 的 3.3 V 檢查', () => {
  it('兩支 GND 本來就相通', onEsp(() => {
    expect(buildNets([], []).same('mcu:GND1', 'mcu:GND2')).toBe(true);
  }));

  it('旋鈕接 3V3 沒問題，讀得到滿格', onEsp(() => {
    const ws = [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:3V3'), w('K1:W', 'mcu:D34')];
    expect(codes([pot], ws).filter((c) => c.startsWith('error'))).toEqual([]);
    const c = new Circuit([pot], ws);
    expect(c.analogRead('D34', {}, { ...noInput, pot: { K1: 1 } })).toBe(1023);
  }));

  it('旋鈕接 VIN（5 V）會擋下來', onEsp(() => {
    expect(codes([pot], [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:VIN'), w('K1:W', 'mcu:D34')])).toContain('error:overvolt-pot');
  }));

  it('VIN 直接接到輸入腳會擋下來', onEsp(() => {
    expect(codes([], [w('mcu:VIN', 'mcu:D34')])).toContain('error:overvolt');
  }));

  it('VIN 和 3V3 接在一起是電源互打', onEsp(() => {
    expect(codes([], [w('mcu:VIN', 'mcu:3V3')])).toContain('error:rails');
  }));

  it('3V3 或 VIN 短路到 GND', onEsp(() => {
    expect(codes([], [w('mcu:3V3', 'mcu:GND2')])).toContain('error:short');
    expect(codes([], [w('mcu:VIN', 'mcu:GND1')])).toContain('error:short');
  }));

  it('按鈕接 D34 會提醒沒有內建上拉，而且讀值真的會浮動', onEsp(() => {
    const ws = [w('mcu:D34', 'B1:1'), w('B1:2', 'mcu:GND1')];
    expect(codes([btn], ws)).toContain('warn:no-pullup');
    expect(codes([btn], [w('mcu:D4', 'B1:1'), w('B1:2', 'mcu:GND1')])).not.toContain('warn:no-pullup');
    // 加了 10kΩ 上拉到 3V3 就不再警告
    expect(codes([btn, r10k], [...ws, w('mcu:D34', 'R2:1'), w('R2:2', 'mcu:3V3')])).not.toContain('warn:no-pullup');
    const c = new Circuit([btn], ws);
    const reads = new Set(Array.from({ length: 40 }, () => c.digitalRead('D34', { D34: { mode: 'INPUT_PULLUP', level: 0 } }, noInput)));
    expect(reads.size).toBe(2);
    const c4 = new Circuit([btn], [w('mcu:D4', 'B1:1'), w('B1:2', 'mcu:GND1')]);
    expect(c4.digitalRead('D4', { D4: { mode: 'INPUT_PULLUP', level: 0 } }, noInput)).toBe(1);
  }));

  it('LED 接在只能輸入的腳會提醒', onEsp(() => {
    expect(codes([led, r220], [w('mcu:D35', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')])).toContain('warn:input-only');
    expect(codes([led, r220], [w('mcu:D18', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')], ['D18'])).not.toContain('warn:input-only');
  }));

  it('D12 被上拉會提醒開機綁腳', onEsp(() => {
    expect(codes([r10k], [w('mcu:D12', 'R2:1'), w('R2:2', 'mcu:3V3')])).toContain('warn:strap');
    expect(codes([r10k], [w('mcu:D13', 'R2:1'), w('R2:2', 'mcu:3V3')])).not.toContain('warn:strap');
  }));

  it('HC-SR04 接 VIN、ECHO 直接進腳位會提醒 5 V 訊號', onEsp(() => {
    const ws = [w('U1:VCC', 'mcu:VIN'), w('U1:GND', 'mcu:GND1'), w('U1:TRIG', 'mcu:D5'), w('U1:ECHO', 'mcu:D19')];
    expect(codes([sonar], ws, ['D5'])).toContain('warn:echo-5v');
  }));

  it('序列腳警告用 TX0／RX0 的名字', onEsp(() => {
    const iss = checkCircuit([led, r220], [w('mcu:D1', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND1')]);
    const s = iss.find((i) => i.code === 'serial-pins');
    expect(s?.text).toContain('TX0');
  }));

  it('Uno 不受 3.3 V 規則影響', () => {
    expect(codes([pot], [w('K1:1', 'mcu:GND1'), w('K1:2', 'mcu:5V'), w('K1:W', 'mcu:A0')])).not.toContain('error:overvolt-pot');
  });
});

describe('ESP32 程式模擬', () => {
  const engine = (comps: Comp[], wires: Wire[], prog = P_ESP_BLINK, params: Record<string, number> = { ms: 100 }, log: string[] = []) =>
    new Engine(comps, wires, prog, params, () => noInput, { serial: (s) => log.push(s), tone: () => {} });

  it('藍燈接在 GPIO2：Blink 會被算成板上 LED 閃爍', onEsp(() => {
    const e = engine([], []);
    for (let t = 0; t < 3000; t += 16) e.tick(16);
    expect(e.obs.blinksL).toBeGreaterThanOrEqual(3);
  }));

  it('Wi-Fi 程式：連線後印 IP，手機開燈／關燈會改變 D18', onEsp(() => {
    const ws = [w('mcu:D18', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'mcu:GND2')];
    const log: string[] = [];
    const e = engine([led, r220], ws, P_ESP_WIFI, {}, log);
    for (let t = 0; t < 4000; t += 16) e.tick(16);
    expect(useWeb.getState().ip).toBeTruthy();
    expect(log.some((l) => l.includes(useWeb.getState().ip!))).toBe(true);
    useWeb.getState().request('/on');
    for (let t = 0; t < 400; t += 16) e.tick(16);
    expect(simVisual.led.L1).toBeGreaterThan(0.5);
    expect(useWeb.getState().on).toBe(1);
    useWeb.getState().request('/off');
    for (let t = 0; t < 400; t += 16) e.tick(16);
    expect(simVisual.led.L1).toBe(0);
    expect(useWeb.getState().off).toBe(1);
    expect(log.some((l) => l.includes('GET /off'))).toBe(true);
  }));
});
