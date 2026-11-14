import { buildNets, UNO_GND, UNO_SUPPLY, type Nets } from './netlist';
import { ep, splitEp, type Comp, type Endpoint, type Wire } from './types';
import type { PinMode } from './programs';

export interface PinOut { mode: PinMode; level: number }

export interface SimInputs {
  pressed: Set<string>;
  pot: Record<string, number>;
  distance: number;
}

/** 依目前的接線、輸出腳狀態與使用者輸入，計算每個節點的電壓（0–1 代表 0–5 V，null 代表浮接） */
export class Circuit {
  private cache = new Map<string, Nets>();
  constructor(public comps: Comp[], public wires: Wire[]) {}

  nets(pressed: Set<string>): Nets {
    const key = [...pressed].sort().join(',');
    let n = this.cache.get(key);
    if (!n) {
      n = buildNets(this.comps, this.wires, pressed);
      this.cache.set(key, n);
    }
    return n;
  }

  private typeOf(id: string) {
    return this.comps.find((c) => c.id === id)?.type;
  }

  /** 不含可變電阻滑臂的直接電位 */
  private directLevel(nets: Nets, e: Endpoint, outs: Record<string, PinOut>): number | null {
    let gnd = false;
    let v: number | null = null;
    for (const m of nets.members(nets.netOf(e))) {
      const [o, p] = splitEp(m);
      if (o === 'uno') {
        if (UNO_GND.includes(m)) gnd = true;
        else if (UNO_SUPPLY.includes(m) || p === 'VIN') v = 1;
        else if (p === '3V3') v = Math.max(v ?? 0, 0.66);
        else if (outs[p]?.mode === 'OUTPUT') v = Math.max(v ?? 0, outs[p].level);
      } else if (this.typeOf(o) === 'psu') {
        if (p === 'N') gnd = true;
        else v = 1;
      }
    }
    if (gnd) return 0;
    return v;
  }

  level(e: Endpoint, outs: Record<string, PinOut>, inp: SimInputs, viaRes = false): number | null {
    const nets = this.nets(inp.pressed);
    const d = this.directLevel(nets, e, outs);
    if (d !== null) return d;
    for (const m of nets.members(nets.netOf(e))) {
      const [o, p] = splitEp(m);
      const t = this.typeOf(o);
      if (t === 'pot' && p === 'W') {
        const v1 = this.directLevel(nets, ep(o, '1'), outs);
        const v2 = this.directLevel(nets, ep(o, '2'), outs);
        if (v1 === null || v2 === null) return null;
        const pos = inp.pot[o] ?? 0.5;
        return v1 + (v2 - v1) * pos;
      }
      if (viaRes && t === 'resistor') {
        const other = ep(o, p === '1' ? '2' : '1');
        if (nets.same(other, e)) continue;
        const v = this.directLevel(nets, other, outs);
        if (v !== null) return v;
      }
    }
    return null;
  }

  /** 端點往外經過的電阻總值（只看一層） */
  resistanceTo(e: Endpoint, inp: SimInputs): number {
    const nets = this.nets(inp.pressed);
    let r = 0;
    for (const m of nets.members(nets.netOf(e))) {
      const [o, p] = splitEp(m);
      if (this.typeOf(o) === 'resistor') {
        const other = ep(o, p === '1' ? '2' : '1');
        if (!nets.same(other, e)) r = Math.max(r, this.comps.find((c) => c.id === o)?.props.ohms ?? 220);
      }
    }
    return r;
  }

  digitalRead(pin: string, outs: Record<string, PinOut>, inp: SimInputs): 0 | 1 {
    const v = this.level(ep('uno', pin), outs, inp);
    if (v === null) return outs[pin]?.mode === 'INPUT_PULLUP' ? 1 : Math.random() > 0.5 ? 1 : 0;
    return v > 0.5 ? 1 : 0;
  }

  analogRead(pin: string, outs: Record<string, PinOut>, inp: SimInputs): number {
    const v = this.level(ep('uno', pin), outs, inp);
    if (v === null) return Math.round(300 + Math.random() * 400);
    return Math.max(0, Math.min(1023, Math.round(v * 1023)));
  }

  ledBrightness(c: Comp, outs: Record<string, PinOut>, inp: SimInputs): number {
    const a = this.level(ep(c.id, 'A'), outs, inp, true);
    const k = this.level(ep(c.id, 'K'), outs, inp, true);
    if (a === null || k === null) return 0;
    const diff = Math.max(0, Math.min(1, a - k));
    const r = Math.max(this.resistanceTo(ep(c.id, 'A'), inp), this.resistanceTo(ep(c.id, 'K'), inp));
    const dim = r >= 4700 ? 0.12 : 1;
    return diff * dim;
  }

  /** 電源腳是否有 5 V、GND 是否和 Uno 共地 */
  powered(c: Comp, vPin: string, gPin: string, outs: Record<string, PinOut>, inp: SimInputs) {
    const nets = this.nets(inp.pressed);
    const v = this.level(ep(c.id, vPin), outs, inp);
    const gEp = ep(c.id, gPin);
    const g = this.level(gEp, outs, inp);
    const common = nets.members(nets.netOf(gEp)).some((m) => UNO_GND.includes(m));
    return { ok: v !== null && v >= 0.9 && g === 0, common };
  }

  /** 某個元件端點所連到的 Uno 腳位 */
  unoPinOf(e: Endpoint, inp: SimInputs): string | null {
    const nets = this.nets(inp.pressed);
    for (const m of nets.members(nets.netOf(e))) {
      const [o, p] = splitEp(m);
      if (o === 'uno' && /^(D\d+|A\d)$/.test(p)) return p;
    }
    return null;
  }
}
