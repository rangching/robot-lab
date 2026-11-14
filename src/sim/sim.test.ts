import { describe, expect, it } from 'vitest';
import { buildNets } from './netlist';
import { checkCircuit } from './rules';
import { Circuit } from './circuit';
import type { Comp, Wire } from './types';

const led: Comp = { id: 'L1', type: 'led', x: 0, z: 0, props: { color: '#f00' } };
const r220: Comp = { id: 'R1', type: 'resistor', x: 0, z: 0, props: { ohms: 220 } };
const r10k: Comp = { id: 'R2', type: 'resistor', x: 0, z: 0, props: { ohms: 10000 } };
const servo: Comp = { id: 'S1', type: 'servo', x: 0, z: 0, props: {} };
const psu: Comp = { id: 'P1', type: 'psu', x: 0, z: 0, props: {} };
const w = (a: string, b: string, i = 0): Wire => ({ id: `w${a}${b}${i}`, a, b, color: '#fff' });
const codes = (c: Comp[], ws: Wire[], outs: string[] | null = null) => checkCircuit(c, ws, outs).map((i) => `${i.level}:${i.code}`);

describe('netlist', () => {
  it('Uno 的三支 GND 本來就相通', () => {
    const n = buildNets([], []);
    expect(n.same('uno:GND1', 'uno:GND3')).toBe(true);
    expect(n.same('uno:A4', 'uno:SDA')).toBe(true);
    expect(n.same('uno:5V', 'uno:GND1')).toBe(false);
  });
  it('按鈕按下才接通', () => {
    const b: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
    const ws = [w('uno:D2', 'B1:1'), w('B1:2', 'uno:GND1')];
    expect(buildNets([b], ws).same('uno:D2', 'uno:GND2')).toBe(false);
    expect(buildNets([b], ws, new Set(['B1'])).same('uno:D2', 'uno:GND2')).toBe(true);
  });
});

describe('上電前檢查', () => {
  it('5V 直接接 GND 是短路', () => {
    expect(codes([], [w('uno:5V', 'uno:GND2')])).toContain('error:short');
  });
  it('正確的 LED 電路沒有錯誤', () => {
    const ws = [w('uno:D9', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'uno:GND3')];
    expect(codes([led, r220], ws, ['D9']).filter((c) => c.startsWith('error'))).toEqual([]);
  });
  it('電阻放在陰極那一側也可以', () => {
    const ws = [w('uno:D9', 'L1:A'), w('L1:K', 'R1:1'), w('R1:2', 'uno:GND1')];
    expect(codes([led, r220], ws, ['D9']).filter((c) => c.startsWith('error'))).toEqual([]);
  });
  it('LED 沒串電阻要擋下來', () => {
    expect(codes([led], [w('uno:D9', 'L1:A'), w('L1:K', 'uno:GND1')], ['D9'])).toContain('error:led-no-res');
    expect(codes([led], [w('uno:5V', 'L1:A'), w('L1:K', 'uno:GND1')])).toContain('error:led-no-res');
  });
  it('LED 接反要警告', () => {
    const ws = [w('uno:D9', 'R1:1'), w('R1:2', 'L1:K'), w('L1:A', 'uno:GND3')];
    expect(codes([led, r220], ws, ['D9'])).toContain('warn:led-reversed');
  });
  it('10kΩ 點 LED 會提醒太暗', () => {
    const ws = [w('uno:D9', 'R2:1'), w('R2:2', 'L1:A'), w('L1:K', 'uno:GND3')];
    expect(codes([led, r10k], ws, ['D9'])).toContain('warn:led-dim');
  });
  it('輸出腳直接接 GND 會短路', () => {
    expect(codes([], [w('uno:D9', 'uno:GND1')], ['D9'])).toContain('error:pin-short');
  });
  it('伺服機用外接電源但沒共地 → 錯誤；共地後通過', () => {
    const base = [w('S1:V', 'P1:P'), w('S1:GND', 'P1:N'), w('S1:SIG', 'uno:D9')];
    expect(codes([servo, psu], base, ['D9'])).toContain('error:no-common-ground');
    const fixed = [...base, w('P1:N', 'uno:GND1')];
    expect(codes([servo, psu], fixed, ['D9']).filter((c) => c.startsWith('error'))).toEqual([]);
  });
  it('伺服機接 Uno 5V 會警告', () => {
    const ws = [w('S1:V', 'uno:5V'), w('S1:GND', 'uno:GND1'), w('S1:SIG', 'uno:D9')];
    expect(codes([servo], ws, ['D9'])).toContain('warn:servo-uno-power');
  });
  it('外接電源 +5V 接 Uno 5V 是兩個電源打架', () => {
    expect(codes([psu], [w('P1:P', 'uno:5V')])).toContain('error:rails');
  });
});

describe('電路模擬', () => {
  it('LED 亮度跟著 D9 的 PWM 走', () => {
    const ws = [w('uno:D9', 'R1:1'), w('R1:2', 'L1:A'), w('L1:K', 'uno:GND3')];
    const c = new Circuit([led, r220], ws);
    const inp = { pressed: new Set<string>(), pot: {}, distance: 40 };
    expect(c.ledBrightness(led, { D9: { mode: 'OUTPUT', level: 1 } }, inp)).toBeCloseTo(1);
    expect(c.ledBrightness(led, { D9: { mode: 'OUTPUT', level: 0.5 } }, inp)).toBeCloseTo(0.5);
    expect(c.ledBrightness(led, { D9: { mode: 'OUTPUT', level: 0 } }, inp)).toBe(0);
  });
  it('可變電阻分壓：analogRead 跟著旋鈕', () => {
    const pot: Comp = { id: 'K1', type: 'pot', x: 0, z: 0, props: {} };
    const ws = [w('K1:1', 'uno:GND1'), w('K1:2', 'uno:5V'), w('K1:W', 'uno:A0')];
    const c = new Circuit([pot], ws);
    expect(c.analogRead('A0', {}, { pressed: new Set(), pot: { K1: 0 }, distance: 0 })).toBe(0);
    expect(c.analogRead('A0', {}, { pressed: new Set(), pot: { K1: 1 }, distance: 0 })).toBe(1023);
    expect(c.analogRead('A0', {}, { pressed: new Set(), pot: { K1: 0.5 }, distance: 0 })).toBe(512);
  });
  it('INPUT_PULLUP 沒按是 HIGH，按下接地變 LOW', () => {
    const b: Comp = { id: 'B1', type: 'button', x: 0, z: 0, props: {} };
    const c = new Circuit([b], [w('uno:D2', 'B1:1'), w('B1:2', 'uno:GND1')]);
    const outs = { D2: { mode: 'INPUT_PULLUP' as const, level: 0 } };
    expect(c.digitalRead('D2', outs, { pressed: new Set(), pot: {}, distance: 0 })).toBe(1);
    expect(c.digitalRead('D2', outs, { pressed: new Set(['B1']), pot: {}, distance: 0 })).toBe(0);
  });
});
