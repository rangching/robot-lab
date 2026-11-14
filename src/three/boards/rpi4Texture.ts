import * as THREE from 'three';
import { RPI_PINS, RPI_W, RPI_D, RPI_FOOTPRINTS, physOf } from '../../data/boards/rpi4';

const W = 2048;
const H = Math.round((W * RPI_D) / RPI_W);
const L = RPI_W * 10; // 板長 mm
const D = RPI_D * 10; // 板寬 mm
const S = W / L; // px / mm

/** 四個 M2.5 固定孔（官方機構圖位置） */
const HOLES: [number, number][] = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]];

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

const pinMm = (p: { x: number; z: number }) => [(p.x + RPI_W / 2) * 10, (RPI_D / 2 - p.z) * 10] as const;

/** 綠色防焊漆＋若隱若現的走線、過孔 */
function base(g: CanvasRenderingContext2D, seed: number) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1f7a43');
  grad.addColorStop(1, '#155f33');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(150, 220, 160, ${0.07 + r() * 0.08})`;
    g.lineWidth = 2 + r() * 4;
    g.beginPath();
    let x = r() * W * 0.8;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 380;
      else y += (r() - 0.5) * 260;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * W * 0.8;
    const y = r() * H;
    g.fillStyle = '#c9a54a';
    g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c2a17';
    g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(248, 250, 246, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

/** 排針焊墊（第 1 腳是方形）與鍍金固定孔 */
function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  for (const p of RPI_PINS) {
    const [x, y] = pinMm(p);
    g.fillStyle = '#d9b456';
    if (physOf(p.id) === 1) g.fillRect(px(x) - 0.85 * S, py(y) - 0.85 * S, 1.7 * S, 1.7 * S);
    else { g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#3a3220';
    g.beginPath(); g.arc(px(x), py(y), 0.45 * S, 0, Math.PI * 2); g.fill();
  }
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#d9b456';
    g.beginPath(); g.arc(px(hx), py(hy), 3.0 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#040506';
    g.beginPath(); g.arc(px(hx), py(hy), 1.375 * S, 0, Math.PI * 2); g.fill();
  }
}

export function makeRpi4Top(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 404);
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  pads(g, px, py);

  // 白色絲印外框（大接頭和金屬罩不畫，它們會蓋住）
  g.strokeStyle = 'rgba(248, 250, 246, 0.85)';
  g.lineWidth = 3;
  const skip = new Set(['gpio', 'eth', 'usb3', 'usb2', 'soc', 'wifi', 'antenna', 'poe', 'sd']);
  for (const [id, [cx, cy, w, h]] of Object.entries(RPI_FOOTPRINTS)) {
    if (skip.has(id)) continue;
    const x0 = Math.max(0.3, cx - w / 2);
    const y0 = Math.max(0.3, cy - h / 2);
    g.strokeRect(px(x0), py(Math.min(D - 0.3, cy + h / 2)), (cx + w / 2 - x0) * S, (Math.min(D - 0.3, cy + h / 2) - y0) * S);
  }

  // 天線區：不鋪銅，看得到淡淡的走線
  g.fillStyle = 'rgba(14, 70, 38, 0.9)';
  g.fillRect(px(0.6), py(50.2), 5.2 * S, 10.4 * S);
  g.strokeStyle = 'rgba(217, 180, 86, 0.9)';
  g.lineWidth = 0.45 * S;
  g.beginPath();
  g.moveTo(px(5.2), py(41.2));
  for (let i = 0; i < 4; i++) {
    g.lineTo(px(1.4), py(42.4 + i * 2));
    g.lineTo(px(1.4), py(43.4 + i * 2));
    g.lineTo(px(5.0), py(43.4 + i * 2));
    g.lineTo(px(5.0), py(44.4 + i * 2));
  }
  g.stroke();

  const text = makeText(g, px, py);
  // GPIO 第 1、2 腳旁邊標號
  text('1', 6.4, 51.2, 1.1, { color: 'rgba(248,250,246,.85)' });
  text('GPIO', 32.5, 48.6, 1.3, { weight: 800 });
  text('CAMERA', 48.4, 11.5, 1.0, { rot: -Math.PI / 2 });
  text('DISPLAY', 5.6, 28.0, 1.0, { rot: -Math.PI / 2 });
  text('POWER IN', 11.2, 8.6, 0.9);
  text('HDMI0', 26.0, 8.6, 0.9);
  text('HDMI1', 39.5, 8.6, 0.9);
  text('A/V', 53.5, 13.6, 0.9);
  text('PoE', 62.0, 40.6, 0.9);
  text('PWR', 4.4, 8.4, 0.8, { align: 'left' });
  text('ACT', 4.4, 11.0, 0.8, { align: 'left' });
  // 板名
  text('Raspberry Pi 4 Model B', 30.0, 21.6, 2.0, { weight: 800 });
  text('ROBOT LAB EDITION · 3.3V GPIO', 30.0, 19.4, 1.0, { weight: 600, color: 'rgba(248,250,246,.72)' });

  g.strokeStyle = 'rgba(248,250,246,.22)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makeRpi4Bottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 808);
  // 從底下看（以長邊為軸翻面）：左右不變、遠近對調，焊墊才會對準正面的排針
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // 接頭固定腳的焊點
  g.fillStyle = '#d9b456';
  for (const [x, y] of [[69.5, 40], [84, 40], [69.5, 21.5], [84, 21.5], [69.5, 3.5], [84, 3.5], [7.5, 1.2], [15, 1.2], [50.5, 2], [56.5, 2]]) {
    g.beginPath(); g.arc(px(x), py(y), 0.9 * S, 0, Math.PI * 2); g.fill();
  }

  const text = makeText(g, px, py);
  // 背面在每支腳旁邊印上 BCM 編號，對照程式比較方便
  for (const p of RPI_PINS) {
    const [x, y] = pinMm(p);
    const odd = physOf(p.id) % 2 === 1;
    const t = p.id.startsWith('GPIO') ? p.id.slice(4) : p.label.replace('GND', 'G').replace('3V3', '3V').replace('ID_SD', 'ID').replace('ID_SC', 'ID');
    text(t, x, odd ? y - 1.7 : y + 1.7, 0.85, { weight: 700, color: p.kind === 'power' ? 'rgba(255,140,150,.95)' : p.kind === 'gnd' ? 'rgba(200,210,220,.8)' : 'rgba(248,250,246,.92)' });
  }
  text('BCM GPIO NUMBERS', 32.5, 46.0, 1.05, { weight: 700, color: 'rgba(248,250,246,.75)' });
  text('RASPBERRY PI 4 MODEL B', 40, 26, 2.2, { weight: 800 });
  text('ROBOT LAB · 3.3V LOGIC · NO ANALOG IN', 40, 22.4, 1.0, { weight: 600, color: 'rgba(248,250,246,.75)' });
  text('microSD', 6.5, 36.2, 1.0, { weight: 700 });
  return finish(c);
}
