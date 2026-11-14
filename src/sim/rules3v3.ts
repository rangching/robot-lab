/**
 * 3.3 V 邏輯板（ESP32、之後的 NodeMCU、Pico、Blue Pill）額外的上電前檢查。
 * 由 rules.ts 的 checkCircuit() 在板子 logicV === 3.3 時呼叫；用回呼取得節點資訊，避免互相 import。
 */
import type { Nets } from './netlist';
import type { NetInfo, Side } from './rules';
import { ep, splitEp, type Comp, type Endpoint, type Issue } from './types';

export interface Ctx3v3 {
  nets: Nets;
  comps: Comp[];
  /** 程式會設成 OUTPUT 的腳；null 代表不知道 */
  outputs: string[] | null;
  info: (e: Endpoint) => NetInfo;
  side: (e: Endpoint) => Side;
  label: (c: Comp) => string;
  /** 板子短名，例如「ESP32」 */
  B: string;
  /** 只能輸入的腳 */
  inputOnly: string[];
  /** 開機綁腳中「開機時不能被拉高」的腳 */
  strapLow: string[];
  /** 可以承受 5 V 數位訊號的腳（STM32 的 FT 腳） */
  tolerant5v?: string[];
  /** 可以輸出、但沒有內建上拉電阻的腳（NodeMCU 的 D0） */
  noPullup?: string[];
  mcuEp: (pin: string) => Endpoint;
}

const has5v = (i: NetInfo) => i.supply5 || i.vin || i.psuP.length > 0;

export function checks3v3(x: Ctx3v3): Issue[] {
  const { nets, comps, outputs, info, side, label, B, inputOnly, strapLow, mcuEp } = x;
  const ft = x.tolerant5v ?? [];
  const issues: Issue[] = [];
  const seen = new Set<string>();

  // 1. 5 V 直接進了 GPIO（輸出腳的情況 rules.ts 已經算短路，這裡只管輸入腳）
  for (const e of nets.all) {
    const n = nets.netOf(e);
    if (seen.has(n)) continue;
    seen.add(n);
    const i = info(e);
    if (!has5v(i)) continue;
    const pins = i.pins.filter((p) => !(outputs ?? []).includes(p) && !ft.includes(p));
    if (pins.length) {
      issues.push({ level: 'error', code: 'overvolt', text: `${pins.join('、')} 直接接到了 5 V！${B} 是 3.3 V 晶片，腳位最多只能承受約 3.6 V，接 5 V 可能永久燒壞。感測器請改接 3V3，或先用電阻分壓。`, endpoints: nets.members(n) });
    }
  }

  for (const c of comps) {
    const L = label(c);
    // 2. 可變電阻兩端接 5 V，中間腳卻接 GPIO
    if (c.type === 'pot') {
      const e1 = info(ep(c.id, '1'));
      const e2 = info(ep(c.id, '2'));
      const w = info(ep(c.id, 'W'));
      if ((has5v(e1) || has5v(e2)) && w.pins.length) {
        issues.push({ level: 'error', code: 'overvolt-pot', text: `${L} 的一端接在 VIN（5 V），轉到底時中間腳會送 5 V 進 ${w.pins.join('、')}，會燒壞 ${B}。把那一端改接 3V3。`, endpoints: [ep(c.id, '1'), ep(c.id, '2'), ep(c.id, 'W')] });
      }
    }
    // 3. HC-SR04 用 5 V 供電時，ECHO 會輸出 5 V
    if (c.type === 'hcsr04') {
      const v = info(ep(c.id, 'VCC'));
      const echo = info(ep(c.id, 'ECHO'));
      if (has5v(v) && echo.pins.some((p) => !ft.includes(p))) {
        issues.push({ level: 'warn', code: 'echo-5v', text: `${L} 接 5 V 時，ECHO 回傳的是 5 V 訊號，直接接 ${echo.pins.join('、')} 會慢慢傷到 ${B}。實際做的時候用 1kΩ＋2kΩ 分壓，或換 3.3 V 版的超音波模組。`, endpoints: [ep(c.id, 'ECHO')] });
      }
    }
    // 4. 只能輸入的腳被拿去驅動 LED、蜂鳴器、伺服機
    const drive: Record<string, string> = { led: 'A', buzzer: 'P', servo: 'SIG', hcsr04: 'TRIG' };
    if (drive[c.type]) {
      const s = side(ep(c.id, drive[c.type]));
      const bad = [...s.pinDirect, ...s.pinViaRes].filter((p) => inputOnly.includes(p));
      if (bad.length) {
        issues.push({ level: 'warn', code: 'input-only', text: `${bad.join('、')} 只能當輸入，沒辦法輸出電壓去驅動${L}。改接其他可以輸出的腳。`, endpoints: [ep(c.id, drive[c.type]), ...bad.map(mcuEp)] });
      }
    }
    // 5. 按鈕接在沒有內建上拉的腳，又沒有外加上拉電阻
    if (c.type === 'button') {
      for (const [a, b] of [['1', '2'], ['2', '1']] as const) {
        const ia = info(ep(c.id, a));
        const ib = info(ep(c.id, b));
        const pins = ia.pins.filter((p) => inputOnly.includes(p) || (x.noPullup ?? []).includes(p));
        if (pins.length && ib.mcuGnd && !side(ep(c.id, a)).supplyViaRes) {
          issues.push({ level: 'warn', code: 'no-pullup', text: `${pins.join('、')} 沒有內建上拉電阻，INPUT_PULLUP 對它沒用；沒按的時候腳位是浮接的，讀值會亂跳。加一顆 10kΩ 接到 3V3，或把按鈕改接有內建上拉的腳。`, endpoints: [ep(c.id, a), ...pins.map(mcuEp)] });
        }
      }
    }
  }

  // 6. 開機綁腳被拉高
  for (const pin of strapLow) {
    const e = mcuEp(pin);
    if (!nets.all.includes(e)) continue;
    const i = info(e);
    const s = side(e);
    if (i.supply3 || i.vin || s.supplyViaRes) {
      issues.push({ level: 'warn', code: 'strap', text: `${pin} 是開機綁腳：開機瞬間如果被拉高，${B} 會進入錯誤的開機模式，結果開不了機或一直重新開機。換一支腳，或確保開機時它是低電位。`, endpoints: [e] });
    }
  }
  return issues;
}

/** 用於訊息：把 'mcu:D34' 這類端點換成腳位名稱 */
export const pinOfEp = (e: Endpoint) => splitEp(e)[1];
