import * as THREE from 'three';
import { BP_PINS, BP_W, BP_D, BP_FOOTPRINTS, BP_MID_Y, BP_FT } from '../../data/boards/bluepill';

const W = 2048;
const H = Math.round((W * BP_D) / BP_W);
const L = BP_W * 10; // 板長 mm
const D = BP_D * 10; // 板寬 mm
const S = W / L; // px / mm

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const pinMm = (p: { x: number; z: number }) => [(p.x + BP_W / 2) * 10, (BP_D / 2 - p.z) * 10] as const;

/** 藍色防焊漆底色＋淡淡的走線與過孔 */
function base(g: CanvasRenderingContext2D, seed: number) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1f5fbf');
  grad.addColorStop(1, '#16469a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 52; i++) {
    g.strokeStyle = `rgba(110, 170, 255, ${0.12 + r() * 0.1})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      // 走線只走水平、垂直或 45°
      const dir = Math.floor(r() * 3);
      const d = (r() - 0.5) * 360;
      if (dir === 0) x += d;
      else if (dir === 1) y += d * 0.6;
      else { x += d * 0.6; y += d * 0.6; }
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 36; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#c9ced6';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b1a33';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(248, 250, 252, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  for (const p of BP_PINS) {
    const [x, y] = pinMm(p);
    g.fillStyle = '#d7dbe0';
    // 第 1 支腳習慣畫成方形焊墊
    if (p.id === 'GND2' || p.id === 'PB12') g.fillRect(px(x) - 0.85 * S, py(y) - 0.85 * S, 1.7 * S, 1.7 * S);
    else { g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#4b5563';
    g.beginPath(); g.arc(px(x), py(y), 0.42 * S, 0, Math.PI * 2); g.fill();
  }
  // SWD 四支針的焊墊
  for (let i = 0; i < 4; i++) {
    const y = BP_MID_Y + 3.81 - i * 2.54;
    g.fillStyle = '#d7dbe0';
    g.beginPath(); g.arc(px(49.6), py(y), 0.8 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4b5563';
    g.beginPath(); g.arc(px(49.6), py(y), 0.4 * S, 0, Math.PI * 2); g.fill();
  }
}

/** 斜放晶片底下的焊墊：四邊各 12 支 */
function chipPads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  const [cx, cy] = BP_FOOTPRINTS.mcu;
  g.save();
  g.translate(px(cx), py(cy));
  g.rotate(Math.PI / 4);
  g.fillStyle = '#cfd5dc';
  for (let side = 0; side < 4; side++) {
    g.save();
    g.rotate((side * Math.PI) / 2);
    for (let i = 0; i < 12; i++) {
      const t = (-5.5 + i) * 0.5;
      g.fillRect(t * S - 0.12 * S, -4.6 * S, 0.24 * S, 1.0 * S);
    }
    g.restore();
  }
  g.restore();
}

export function makeBluepillTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 23);
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  pads(g, px, py);
  chipPads(g, px, py);

  g.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  g.lineWidth = 3;
  for (const [id, [cx, cy, w, h]] of Object.entries(BP_FOOTPRINTS)) {
    if (id === 'hdrF' || id === 'hdrN' || id === 'mcu' || id === 'boot' || id === 'swd') continue;
    const x0 = Math.max(0.3, cx - w / 2);
    g.strokeRect(px(x0), py(cy + h / 2), (cx + w / 2 - x0) * S, h * S);
  }

  const text = makeText(g, px, py);
  // 腳位標籤：標在排針內側，文字沿板子短邊方向
  for (const p of BP_PINS) {
    const [x, y] = pinMm(p);
    const far = y > BP_MID_Y;
    text(p.label, x, far ? y - 1.4 : y + 1.4, 0.9, { rot: -Math.PI / 2, align: far ? 'right' : 'left', weight: 600 });
  }
  text('R10', 8.2, 11.1, 0.8, { color: 'rgba(248,250,252,.8)' });
  text('BOOT  0 · 1', 24.0, 11.2, 0.8);
  text('RESET', 24.0, 5.8, 0.85);
  text('8MHz', 15.4, 7.5, 0.8, { color: 'rgba(248,250,252,.8)' });
  text('32K', 42.6, 11.0, 0.75, { color: 'rgba(248,250,252,.8)' });
  text('PWR', 44.6, 12.9, 0.75);
  text('PC13', 47.8, 12.9, 0.75);
  // SWD 針旁的標示
  ['3.3', 'IO', 'CLK', 'G'].forEach((t, i) => text(t, 47.6, BP_MID_Y + 3.81 - i * 2.54, 0.8, { align: 'right', weight: 600 }));

  g.strokeStyle = 'rgba(248,250,252,.22)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makeBluepillBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 61);
  // 底面：Box 的 -Y 面 u 仍沿 +x、v 方向相反；從下往上看 +x 在右、+z 在上，所以 x 不必對調
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // USB 固定腳焊點
  g.fillStyle = '#d7dbe0';
  for (const dy of [-3.6, 3.6]) g.fillRect(px(4.2) - 1.2 * S, py(BP_MID_Y + dy) - 0.7 * S, 1.2 * S, 1.4 * S);

  const text = makeText(g, px, py);
  // 背面寫完整的腳位名稱；5 V 容忍腳加一個小點
  for (const p of BP_PINS) {
    const [x, y] = pinMm(p);
    const far = y > BP_MID_Y;
    const ft = BP_FT.includes(p.id);
    text(p.id.replace(/^GND\d$/, 'GND').replace('3V3b', '3V3'), x, far ? y - 1.4 : y + 1.4, 0.85, {
      // 底面的 y 沒有翻轉，對齊方向要和正面相反，文字才會朝板子內側
      rot: -Math.PI / 2, align: far ? 'left' : 'right', weight: 600, color: ft ? 'rgba(255,214,102,.95)' : undefined,
    });
  }
  text('STM32F103C8T6', 26.5, BP_MID_Y + 2.2, 2.0, { weight: 800, italic: true });
  text('ROBOT LAB · BLUE PILL · 3.3V', 26.5, BP_MID_Y - 1.0, 0.95, { weight: 600, color: 'rgba(248,250,252,.78)' });
  text('YELLOW = 5V TOLERANT (FT)', 26.5, BP_MID_Y - 3.2, 0.85, { weight: 600, color: 'rgba(255,214,102,.9)' });
  return finish(c);
}
