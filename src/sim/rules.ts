import { buildNets, UNO_GND, UNO_SUPPLY, type Nets } from './netlist';
import { ep, splitEp, type Comp, type Endpoint, type Issue, type Wire } from './types';

export interface NetInfo {
  supply5: boolean;
  supply3: boolean;
  vin: boolean;
  unoGnd: boolean;
  psuP: string[];
  psuN: string[];
  pins: string[];
  resLegs: Endpoint[];
}

export function netInfo(nets: Nets, e: Endpoint, comps: Comp[]): NetInfo {
  const info: NetInfo = { supply5: false, supply3: false, vin: false, unoGnd: false, psuP: [], psuN: [], pins: [], resLegs: [] };
  const typeOf = new Map(comps.map((c) => [c.id, c.type]));
  for (const m of nets.members(nets.netOf(e))) {
    const [o, p] = splitEp(m);
    if (o === 'uno') {
      if (UNO_SUPPLY.includes(m)) info.supply5 = true;
      else if (p === '3V3') info.supply3 = true;
      else if (p === 'VIN') info.vin = true;
      else if (UNO_GND.includes(m)) info.unoGnd = true;
      else if (/^(D\d+|A\d)$/.test(p)) info.pins.push(p);
    } else {
      const t = typeOf.get(o);
      if (t === 'psu') (p === 'P' ? info.psuP : info.psuN).push(o);
      if (t === 'resistor') info.resLegs.push(m);
    }
  }
  return info;
}

const otherLeg = (leg: Endpoint) => {
  const [o, p] = splitEp(leg);
  return ep(o, p === '1' ? '2' : '1');
};

export interface Side {
  /** 直接（不經電阻）就有電源或輸出腳 */
  srcDirect: boolean;
  gndDirect: boolean;
  srcViaRes: boolean;
  gndViaRes: boolean;
  /** 經過的電阻值 */
  ohms: number[];
  /** 直接或經一顆電阻接到的 Uno 腳位 */
  pinDirect: string[];
  pinViaRes: string[];
  supplyDirect: boolean;
  supplyViaRes: boolean;
}

/** 從端點往外看一層：直接接到什麼、隔一顆電阻接到什麼 */
export function sideOf(nets: Nets, e: Endpoint, comps: Comp[], outputs: string[] | null): Side {
  const isOut = (p: string) => (outputs ? outputs.includes(p) : true);
  const d = netInfo(nets, e, comps);
  const s: Side = {
    srcDirect: false, gndDirect: false, srcViaRes: false, gndViaRes: false, ohms: [],
    pinDirect: d.pins, pinViaRes: [], supplyDirect: false, supplyViaRes: false,
  };
  s.supplyDirect = d.supply5 || d.supply3 || d.vin || d.psuP.length > 0;
  s.srcDirect = s.supplyDirect || d.pins.some(isOut);
  s.gndDirect = d.unoGnd || d.psuN.length > 0;
  for (const leg of d.resLegs) {
    const o = otherLeg(leg);
    if (nets.same(o, e)) continue;
    const r = comps.find((c) => c.id === splitEp(leg)[0]);
    s.ohms.push(r?.props.ohms ?? 220);
    const v = netInfo(nets, o, comps);
    const sup = v.supply5 || v.supply3 || v.vin || v.psuP.length > 0;
    s.supplyViaRes ||= sup;
    s.srcViaRes ||= sup || v.pins.some(isOut);
    s.gndViaRes ||= v.unoGnd || v.psuN.length > 0;
    s.pinViaRes.push(...v.pins);
  }
  return s;
}

const NAME_OF = (c: Comp, idx: number) => {
  const n: Record<string, string> = { led: 'LED', resistor: '電阻', button: '按鈕', pot: '可變電阻', buzzer: '蜂鳴器', servo: '伺服機', hcsr04: '超音波模組', psu: '外接電源' };
  return `${n[c.type]}${idx > 1 ? ` #${idx}` : ''}`;
};

/**
 * 上電前檢查。outputs：程式會設成 OUTPUT 的腳位（null 代表不知道，例如自由建構）
 */
export function checkCircuit(comps: Comp[], wires: Wire[], outputs: string[] | null = null): Issue[] {
  const nets = buildNets(comps, wires);
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const counter: Record<string, number> = {};
  const label = new Map<string, string>();
  for (const c of comps) {
    counter[c.type] = (counter[c.type] ?? 0) + 1;
    label.set(c.id, NAME_OF(c, counter[c.type]));
  }

  // 1. 每個節點的短路檢查
  for (const e of nets.all) {
    const n = nets.netOf(e);
    if (seen.has(n)) continue;
    seen.add(n);
    const i = netInfo(nets, e, comps);
    const mem = nets.members(n);
    const sup = i.supply5 || i.supply3 || i.vin;
    if (sup && i.unoGnd) issues.push({ level: 'error', code: 'short', text: '短路！Uno 的電源腳（5V／3.3V／VIN）直接接到了 GND，通電會讓穩壓器過熱甚至燒毀 USB 埠。', endpoints: mem });
    else if (i.psuP.length && (i.psuN.length || i.unoGnd)) issues.push({ level: 'error', code: 'short', text: '短路！外接電源的 +5V 直接接到了 GND。', endpoints: mem });
    if (i.supply5 && i.supply3) issues.push({ level: 'error', code: 'rails', text: '5V 和 3.3V 接在一起了，兩個電壓會互相打架。', endpoints: mem });
    if (i.psuP.length && (i.supply5 || i.supply3 || i.vin)) issues.push({ level: 'error', code: 'rails', text: '外接電源的 +5V 和 Uno 的電源腳接在一起了。兩個電源只要「共地」，正極不要互接。', endpoints: mem });
    if (outputs) {
      const outs = i.pins.filter((p) => outputs.includes(p));
      if (outs.length && (sup || i.psuP.length)) issues.push({ level: 'error', code: 'pin-short', text: `${outs.join('、')} 被程式設成輸出，卻直接接到電源；輸出 LOW 時會短路。`, endpoints: mem });
      else if (outs.length && (i.unoGnd || i.psuN.length)) issues.push({ level: 'error', code: 'pin-short', text: `${outs.join('、')} 被程式設成輸出，卻直接接到 GND；輸出 HIGH 時會短路。`, endpoints: mem });
      if (outs.length > 1) issues.push({ level: 'warn', code: 'out-out', text: `${outs.join(' 和 ')} 兩支輸出腳接在一起，電位不同時會互相拉扯。`, endpoints: mem });
    }
    if (i.pins.includes('D0') || i.pins.includes('D1')) {
      if (mem.some((m) => !m.startsWith('uno:'))) issues.push({ level: 'warn', code: 'serial-pins', text: 'D0／D1 和 USB 序列埠共用，接了東西可能讓程式上傳失敗。換到其他腳位比較保險。', endpoints: mem.filter((m) => m === 'uno:D0' || m === 'uno:D1') });
    }
  }

  // 2. 元件規則
  for (const c of comps) {
    const L = label.get(c.id)!;
    if (c.type === 'led') {
      const A = ep(c.id, 'A');
      const K = ep(c.id, 'K');
      if (nets.same(A, K)) {
        issues.push({ level: 'warn', code: 'led-bypass', text: `${L} 的兩隻腳接在同一個點，電流會繞過它，永遠不會亮。`, endpoints: [A, K] });
        continue;
      }
      const a = sideOf(nets, A, comps, outputs);
      const k = sideOf(nets, K, comps, outputs);
      if ((a.srcDirect && k.gndDirect) || (a.supplyDirect && k.srcDirect && !k.supplyDirect)) {
        issues.push({ level: 'error', code: 'led-no-res', text: `${L} 沒有串限流電阻！5 V 直接灌進 LED，電流會遠超過 20 mA，LED 和腳位都可能燒壞。在 LED 和腳位之間加一顆 220Ω 電阻。`, endpoints: [A, K] });
      } else if ((a.gndDirect || a.gndViaRes) && (k.srcDirect || k.srcViaRes) && !(a.srcDirect || a.srcViaRes)) {
        issues.push({ level: 'warn', code: 'led-reversed', text: `${L} 好像接反了：長腳（＋）要朝向電源或輸出腳，短腳（−）朝向 GND。接反不會壞，但不會亮。`, endpoints: [A, K] });
      } else if ((a.srcViaRes && k.gndDirect) || (a.srcDirect && k.gndViaRes)) {
        const r = [...a.ohms, ...k.ohms];
        if (r.some((x) => x >= 4700)) issues.push({ level: 'warn', code: 'led-dim', text: `${L} 串了 10kΩ，電流只剩約 0.3 mA，會非常暗。點亮 LED 用 220Ω 比較剛好。`, endpoints: [A, K] });
      }
    }
    if (c.type === 'servo') {
      const V = ep(c.id, 'V');
      const G = ep(c.id, 'GND');
      const S = ep(c.id, 'SIG');
      const v = netInfo(nets, V, comps);
      const g = netInfo(nets, G, comps);
      const s = netInfo(nets, S, comps);
      if (v.supply5 || v.vin) issues.push({ level: 'warn', code: 'servo-uno-power', text: `${L} 從 Uno 的 5V 取電：轉動瞬間電流可達數百 mA，可能讓板子重新開機。建議改用外接 5V 電源，再把兩邊 GND 接在一起。`, endpoints: [V] });
      if (v.supply3) issues.push({ level: 'warn', code: 'servo-3v3', text: `${L} 接在 3.3V，電壓不夠也供不了那麼大電流，會轉不動。`, endpoints: [V] });
      if (v.psuP.length && g.psuN.length && s.pins.length && !g.unoGnd) {
        issues.push({ level: 'error', code: 'no-common-ground', text: `${L} 用外接電源，但外接電源的 GND 沒有接到 Uno 的 GND（沒有共地）。訊號沒有共同的 0 V 參考，伺服機會亂抖或不動。把外接電源的 GND 接到 Uno 的 GND。`, endpoints: [G, 'uno:GND1', 'uno:GND2', 'uno:GND3'] });
      }
    }
    if (c.type === 'hcsr04') {
      const V = ep(c.id, 'VCC');
      const G = ep(c.id, 'GND');
      const v = netInfo(nets, V, comps);
      const g = netInfo(nets, G, comps);
      if (v.supply3) issues.push({ level: 'warn', code: 'sr04-3v3', text: `${L} 需要 5 V，接 3.3V 量到的距離會不準甚至沒反應。`, endpoints: [V] });
      if (v.psuP.length && !g.unoGnd && (netInfo(nets, ep(c.id, 'ECHO'), comps).pins.length > 0)) {
        issues.push({ level: 'error', code: 'no-common-ground', text: `${L} 用外接電源，但沒有和 Uno 共地，ECHO 訊號 Uno 讀不到。`, endpoints: [G, 'uno:GND1'] });
      }
    }
  }
  return issues;
}

export const hasError = (iss: Issue[]) => iss.some((i) => i.level === 'error');
