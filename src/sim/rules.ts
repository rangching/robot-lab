import { buildNets, type Nets } from './netlist';
import { MCU, gndEps, supplyEps, simBoard, IO_PIN } from './board';
import { ep, splitEp, type Comp, type Endpoint, type Issue, type Wire } from './types';
import { checks3v3 } from './rules3v3';

export interface NetInfo {
  supply5: boolean;
  supply3: boolean;
  vin: boolean;
  mcuGnd: boolean;
  psuP: string[];
  psuN: string[];
  pins: string[];
  resLegs: Endpoint[];
}

export function netInfo(nets: Nets, e: Endpoint, comps: Comp[]): NetInfo {
  const info: NetInfo = { supply5: false, supply3: false, vin: false, mcuGnd: false, psuP: [], psuN: [], pins: [], resLegs: [] };
  const typeOf = new Map(comps.map((c) => [c.id, c.type]));
  const S = supplyEps();
  const G = gndEps();
  for (const m of nets.members(nets.netOf(e))) {
    const [o, p] = splitEp(m);
    if (o === MCU) {
      if (S.includes(m)) info.supply5 = true;
      else if (p === '3V3') info.supply3 = true;
      else if (p === 'VIN') info.vin = true;
      else if (G.includes(m)) info.mcuGnd = true;
      else if (IO_PIN.test(p)) info.pins.push(p);
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
  /** 直接或經一顆電阻接到的開發板腳位 */
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
  s.gndDirect = d.mcuGnd || d.psuN.length > 0;
  for (const leg of d.resLegs) {
    const o = otherLeg(leg);
    if (nets.same(o, e)) continue;
    const r = comps.find((c) => c.id === splitEp(leg)[0]);
    s.ohms.push(r?.props.ohms ?? 220);
    const v = netInfo(nets, o, comps);
    const sup = v.supply5 || v.supply3 || v.vin || v.psuP.length > 0;
    s.supplyViaRes ||= sup;
    s.srcViaRes ||= sup || v.pins.some(isOut);
    s.gndViaRes ||= v.mcuGnd || v.psuN.length > 0;
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
  const B = simBoard().short;
  const gndList = gndEps();
  const analogOnly = simBoard().analogOnly;
  const typeOf = new Map(comps.map((c) => [c.id, c.type]));
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
    if (sup && i.mcuGnd) issues.push({ level: 'error', code: 'short', text: `短路！${B} 的電源腳（5V／3.3V／VIN）直接接到了 GND，通電會讓穩壓器過熱甚至燒毀 USB 埠。`, endpoints: mem });
    else if (i.psuP.length && (i.psuN.length || i.mcuGnd)) issues.push({ level: 'error', code: 'short', text: '短路！外接電源的 +5V 直接接到了 GND。', endpoints: mem });
    if ((i.supply5 || i.vin) && i.supply3) issues.push({ level: 'error', code: 'rails', text: `${i.supply5 ? '5V' : 'VIN'} 和 3.3V 接在一起了，兩個電壓會互相打架。`, endpoints: mem });
    if (i.psuP.length && (i.supply5 || i.supply3 || i.vin)) issues.push({ level: 'error', code: 'rails', text: `外接電源的 +5V 和 ${B} 的電源腳接在一起了。兩個電源只要「共地」，正極不要互接。`, endpoints: mem });
    if (outputs) {
      const outs = i.pins.filter((p) => outputs.includes(p));
      if (outs.length && (sup || i.psuP.length)) issues.push({ level: 'error', code: 'pin-short', text: `${outs.join('、')} 被程式設成輸出，卻直接接到電源；輸出 LOW 時會短路。`, endpoints: mem });
      else if (outs.length && (i.mcuGnd || i.psuN.length)) issues.push({ level: 'error', code: 'pin-short', text: `${outs.join('、')} 被程式設成輸出，卻直接接到 GND；輸出 HIGH 時會短路。`, endpoints: mem });
      if (outs.length > 1) issues.push({ level: 'warn', code: 'out-out', text: `${outs.join(' 和 ')} 兩支輸出腳接在一起，電位不同時會互相拉扯。`, endpoints: mem });
    }
    const serial = simBoard().serialPins ?? ['D0', 'D1'];
    if (serial.some((p) => i.pins.includes(p))) {
      const names = serial.map((id) => simBoard().pins.find((p) => p.id === id)?.label ?? id).join('／');
      if (mem.some((m) => !m.startsWith(`${MCU}:`))) issues.push({ level: 'warn', code: 'serial-pins', text: `${names} 和 USB 序列埠共用，接了東西可能讓程式上傳失敗。換到其他腳位比較保險。`, endpoints: mem.filter((m) => serial.some((p) => m === `${MCU}:${p}`)) });
    }
    // 不能用的腳（NodeMCU 接 flash 的 SD0–SD3、CMD、CLK，或保留腳）接了東西
    const ncPins = mem.filter((m) => m.startsWith(`${MCU}:`) && simBoard().pins.find((p) => `${MCU}:${p.id}` === m)?.kind === 'nc');
    if (ncPins.length && mem.some((m) => !m.startsWith(`${MCU}:`))) {
      const names = ncPins.map((m) => simBoard().pins.find((p) => `${MCU}:${p.id}` === m)!.label).join('、');
      issues.push({ level: 'warn', code: 'nc-pin', text: `${names} 不能拿來接零件：它不是一般的 GPIO（可能接著板子內部的 flash 記憶體，或是保留腳）。接了不會動，還可能讓程式當掉。請改接一般的數位腳。`, endpoints: ncPins });
    }
    const ao = i.pins.filter((p) => analogOnly.includes(p));
    if (ao.length) {
      const bad = mem.filter((m) => {
        const [o, p] = splitEp(m);
        const t = typeOf.get(o);
        return o !== MCU && !(t === 'pot' && p === 'W');
      });
      if (bad.length) issues.push({ level: 'warn', code: 'analog-only', text: `${ao.join('、')} 是純類比腳，只能用 analogRead() 讀電壓，不能 digitalRead()、也不能輸出。按鈕、LED 請改接${simBoard().logicV === 3.3 ? '一般的數位腳（例如 D5）' : ' D2–D13 或 A0–A5'}。`, endpoints: [...ao.map((p) => `${MCU}:${p}`), ...bad] });
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
        issues.push({ level: 'error', code: 'led-no-res', text: `${L} 沒有串限流電阻！${simBoard().logicV ?? 5} V 直接灌進 LED，電流會遠超過 20 mA，LED 和腳位都可能燒壞。在 LED 和腳位之間加一顆 220Ω 電阻。`, endpoints: [A, K] });
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
      if (v.supply5 || v.vin) issues.push({ level: 'warn', code: 'servo-uno-power', text: `${L} 從 ${B} 的 5V 取電：轉動瞬間電流可達數百 mA，可能讓板子重新開機。建議改用外接 5V 電源，再把兩邊 GND 接在一起。`, endpoints: [V] });
      if (v.supply3) issues.push({ level: 'warn', code: 'servo-3v3', text: `${L} 接在 3.3V，電壓不夠也供不了那麼大電流，會轉不動。`, endpoints: [V] });
      if (v.psuP.length && g.psuN.length && s.pins.length && !g.mcuGnd) {
        issues.push({ level: 'error', code: 'no-common-ground', text: `${L} 用外接電源，但外接電源的 GND 沒有接到 ${B} 的 GND（沒有共地）。訊號沒有共同的 0 V 參考，伺服機會亂抖或不動。把外接電源的 GND 接到 ${B} 的 GND。`, endpoints: [G, ...gndList] });
      }
    }
    if (c.type === 'hcsr04') {
      const V = ep(c.id, 'VCC');
      const G = ep(c.id, 'GND');
      const v = netInfo(nets, V, comps);
      const g = netInfo(nets, G, comps);
      if (v.supply3) issues.push({ level: 'warn', code: 'sr04-3v3', text: `${L} 需要 5 V，接 3.3V 量到的距離會不準甚至沒反應。`, endpoints: [V] });
      if (v.psuP.length && !g.mcuGnd && (netInfo(nets, ep(c.id, 'ECHO'), comps).pins.length > 0)) {
        issues.push({ level: 'error', code: 'no-common-ground', text: `${L} 用外接電源，但沒有和 ${B} 共地，ECHO 訊號 ${B} 讀不到。`, endpoints: [G, ...gndList] });
      }
    }
  }
  // 3. 3.3 V 邏輯板的額外檢查（5 V 進腳位、只能輸入的腳、開機綁腳……）
  const board = simBoard();
  if (board.logicV === 3.3) {
    issues.push(
      ...checks3v3({
        nets,
        comps,
        outputs,
        info: (e) => netInfo(nets, e, comps),
        side: (e) => sideOf(nets, e, comps, outputs),
        label: (c) => label.get(c.id)!,
        B,
        inputOnly: board.inputOnly ?? [],
        strapLow: board.strapLow ?? [],
        tolerant5v: board.tolerant5v ?? [],
        noPullup: board.noPullup ?? [],
        mcuEp: (p) => `${MCU}:${p}`,
      }),
    );
  }
  return issues;
}

export const hasError = (iss: Issue[]) => iss.some((i) => i.level === 'error');
