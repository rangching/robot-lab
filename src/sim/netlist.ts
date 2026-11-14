import { UNO_PINS, UNO_INTERNAL_NETS } from '../data/boards/uno';
import { CATALOG } from './catalog';
import { ep, splitEp, type Comp, type Endpoint, type Wire } from './types';

class DSU {
  p = new Map<string, string>();
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r)!;
    let c = x;
    while (this.p.get(c) !== r) {
      const n = this.p.get(c)!;
      this.p.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
}

export const UNO_SUPPLY = ['uno:5V', 'uno:IOREF'];
export const UNO_GND = ['uno:GND1', 'uno:GND2', 'uno:GND3'];

export interface Nets {
  netOf: (e: Endpoint) => string;
  members: (net: string) => Endpoint[];
  same: (a: Endpoint, b: Endpoint) => boolean;
  all: Endpoint[];
}

export function allEndpoints(comps: Comp[]): Endpoint[] {
  const out: Endpoint[] = UNO_PINS.map((p) => ep('uno', p.id));
  for (const c of comps) for (const p of CATALOG[c.type].pins) out.push(ep(c.id, p.id));
  return out;
}

/** 依接線建立電氣節點；pressed 為正在被按下的按鈕 id */
export function buildNets(comps: Comp[], wires: Wire[], pressed: Set<string> = new Set()): Nets {
  const d = new DSU();
  const all = allEndpoints(comps);
  all.forEach((e) => d.find(e));
  for (const group of UNO_INTERNAL_NETS) for (let i = 1; i < group.length; i++) d.union(ep('uno', group[0]), ep('uno', group[i]));
  for (const w of wires) d.union(w.a, w.b);
  for (const c of comps) if (c.type === 'button' && pressed.has(c.id)) d.union(ep(c.id, '1'), ep(c.id, '2'));
  const groups = new Map<string, Endpoint[]>();
  for (const e of all) {
    const r = d.find(e);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(e);
  }
  return {
    netOf: (e) => d.find(e),
    members: (n) => groups.get(n) ?? [],
    same: (a, b) => d.find(a) === d.find(b),
    all,
  };
}

/** 端點屬於哪個元件；Uno 回傳 null */
export function compOf(e: Endpoint, comps: Comp[]): Comp | null {
  const [owner] = splitEp(e);
  if (owner === 'uno') return null;
  return comps.find((c) => c.id === owner) ?? null;
}

export function isUnoDigital(e: Endpoint) {
  const [o, p] = splitEp(e);
  return o === 'uno' && /^(D\d+|A\d)$/.test(p);
}
