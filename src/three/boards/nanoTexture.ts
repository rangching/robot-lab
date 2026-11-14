import * as THREE from 'three';
import { NANO_PINS, NANO_W, NANO_D, NANO_FOOTPRINTS, nanoLesson } from '../../data/boards/nano';

const W = 2048;
const H = Math.round((W * NANO_D) / NANO_W);
const L = NANO_W * 10; // 板長 mm
const S = W / L; // px / mm

const BOTTOM_IDS = new Set(nanoLesson.parts.filter((p) => p.side === 'bottom').map((p) => p.id));
const HOLES: [number, number][] = [[1.5, 1.5], [1.5, 16.5], [41.7, 1.5], [41.7, 16.5]];

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

const pinMm = (p: { x: number; z: number }) => [(p.x + NANO_W / 2) * 10, (NANO_D / 2 - p.z) * 10] as const;

/** 共用：底色、走線、過孔 */
function base(g: CanvasRenderingContext2D, seed: number, c0: string, c1: string) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(70, 140, 220, ${0.16 + r() * 0.14})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 500;
      else y += (r() - 0.5) * 260;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 36; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#c9a54a';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0a2440';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(244, 248, 252, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  for (const p of NANO_PINS) {
    const [x, y] = pinMm(p);
    g.fillStyle = '#d7dbe0';
    g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6b6f75';
    g.beginPath(); g.arc(px(x), py(y), 0.42 * S, 0, Math.PI * 2); g.fill();
  }
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#d9b456';
    g.beginPath(); g.arc(px(hx), py(hy), 1.15 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#04070c';
    g.beginPath(); g.arc(px(hx), py(hy), 0.75 * S, 0, Math.PI * 2); g.fill();
  }
}

/** 腳位標籤：標在排針內側，文字沿板子短邊方向 */
function pinLabels(text: ReturnType<typeof makeText>) {
  for (const p of NANO_PINS) {
    const [x, y] = pinMm(p);
    const far = y > 9;
    text(p.label, x, far ? y - 1.25 : y + 1.25, 0.95, { rot: -Math.PI / 2, align: far ? 'right' : 'left', weight: 600 });
  }
}

export function makeNanoTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 11, '#17508f', '#0f3a6b');
  const px = (x: number) => x * S;
  const py = (y: number) => (18 - y) * S;
  pads(g, px, py);

  g.strokeStyle = 'rgba(240, 246, 252, 0.85)';
  g.lineWidth = 3;
  for (const [id, [cx, cy, w, h]] of Object.entries(NANO_FOOTPRINTS)) {
    if (BOTTOM_IDS.has(id) || id === 'hdrF' || id === 'hdrN' || id === 'mcu') continue;
    g.strokeRect(px(Math.max(0.3, cx - w / 2)), py(cy + h / 2), Math.min(w, (cx + w / 2) - Math.max(0.3, cx - w / 2)) * S, h * S);
  }
  // 斜放晶片的菱形外框
  g.save();
  g.translate(px(22), py(9));
  g.rotate(Math.PI / 4);
  g.strokeRect(-4.2 * S, -4.2 * S, 8.4 * S, 8.4 * S);
  g.restore();

  const text = makeText(g, px, py);
  pinLabels(text);
  text('TX', 9.8, 8.4, 0.75);
  text('RX', 11.4, 8.4, 0.75);
  text('L', 13.4, 8.4, 0.75);
  text('POW', 15.6, 8.4, 0.75);
  text('RST', 32, 13.0, 0.8, { color: 'rgba(244,248,252,.8)' });
  text('16MHz', 12.6, 13.5, 0.7, { color: 'rgba(244,248,252,.75)' });
  // ICSP 第 1 腳標記
  g.fillStyle = 'rgba(244,248,252,.95)';
  g.beginPath(); g.arc(px(37.1), py(5.2), 0.35 * S, 0, Math.PI * 2); g.fill();

  g.strokeStyle = 'rgba(240,248,252,.25)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makeNanoBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 29, '#134782', '#0e3561');
  // Box 的 -Y 面：u 仍沿 +x、v 方向相反，所以畫布上方 = 板子前緣（mm y = 0）
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // ICSP 與 USB 的穿孔焊點
  g.fillStyle = '#d7dbe0';
  for (const dx of [-1.27, 1.27]) for (const dy of [-2.54, 0, 2.54]) {
    g.beginPath(); g.arc(px(40.05 + dx), py(9 + dy), 0.75 * S, 0, Math.PI * 2); g.fill();
  }
  for (const dy of [-3.2, 3.2]) g.fillRect(px(5.6), py(9 + dy) - 0.7 * S, 1.4 * S, 1.4 * S);

  g.strokeStyle = 'rgba(240, 246, 252, 0.85)';
  g.lineWidth = 3;
  for (const id of BOTTOM_IDS) {
    const [cx, cy, w, h] = NANO_FOOTPRINTS[id];
    g.strokeRect(px(cx - w / 2), py(cy - h / 2), w * S, h * S);
  }

  const text = makeText(g, px, py);
  text('NANO', 33.6, 10.2, 3.2, { weight: 800, italic: true });
  text('ROBOT LAB', 33.6, 6.6, 1.0, { weight: 600, color: 'rgba(244,248,252,.75)' });
  text('CH340', 24, 13.2, 0.8, { color: 'rgba(244,248,252,.8)' });
  text('5V REG', 11.5, 13.5, 0.8, { color: 'rgba(244,248,252,.8)' });
  return finish(c);
}
