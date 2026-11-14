import * as THREE from 'three';
import { ESP_PINS, ESP_W, ESP_D, ESP_FOOTPRINTS, ESP_MID_Y } from '../../data/boards/esp32';

const W = 2048;
const H = Math.round((W * ESP_D) / ESP_W);
const L = ESP_W * 10; // 板長 mm
const D = ESP_D * 10; // 板寬 mm
const S = W / L; // px / mm

const HOLES: [number, number][] = [[1.6, 1.6], [1.6, D - 1.6], [L - 1.6, 1.6], [L - 1.6, D - 1.6]];

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

const pinMm = (p: { x: number; z: number }) => [(p.x + ESP_W / 2) * 10, (ESP_D / 2 - p.z) * 10] as const;

/** 黑色防焊漆底色＋若隱若現的走線與過孔 */
function base(g: CanvasRenderingContext2D, seed: number) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#202329');
  grad.addColorStop(1, '#131519');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(120, 130, 150, ${0.08 + r() * 0.08})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W * 0.62;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 420;
      else y += (r() - 0.5) * 300;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * W * 0.6;
    const y = r() * H;
    g.fillStyle = '#b9bec6';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b0c0e';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(246, 247, 249, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  for (const p of ESP_PINS) {
    const [x, y] = pinMm(p);
    g.fillStyle = '#d7dbe0';
    g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5d6168';
    g.beginPath(); g.arc(px(x), py(y), 0.42 * S, 0, Math.PI * 2); g.fill();
  }
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#c9ced6';
    g.beginPath(); g.arc(px(hx), py(hy), 1.25 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#040506';
    g.beginPath(); g.arc(px(hx), py(hy), 0.8 * S, 0, Math.PI * 2); g.fill();
  }
}

/** 腳位標籤：標在排針內側，文字沿板子短邊方向 */
function pinLabels(text: ReturnType<typeof makeText>) {
  for (const p of ESP_PINS) {
    const [x, y] = pinMm(p);
    const far = y > ESP_MID_Y;
    text(p.label, x, far ? y - 1.3 : y + 1.3, 0.95, { rot: -Math.PI / 2, align: far ? 'right' : 'left', weight: 600 });
  }
}

export function makeEsp32Top(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 41);
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  pads(g, px, py);

  // 模組底下的焊墊排（從模組邊緣露出一點點）
  g.fillStyle = '#c9a54a';
  for (let i = 0; i < 14; i++) {
    const x = 27.2 + i * 1.27;
    g.fillRect(px(x) - 0.3 * S, py(ESP_MID_Y + 9.35) , 0.6 * S, 0.5 * S);
    g.fillRect(px(x) - 0.3 * S, py(ESP_MID_Y - 8.85), 0.6 * S, 0.5 * S);
  }

  g.strokeStyle = 'rgba(246, 247, 249, 0.85)';
  g.lineWidth = 3;
  for (const [id, [cx, cy, w, h]] of Object.entries(ESP_FOOTPRINTS)) {
    if (id === 'hdrF' || id === 'hdrN' || id === 'mcu' || id === 'antenna') continue;
    const x0 = Math.max(0.3, cx - w / 2);
    g.strokeRect(px(x0), py(cy + h / 2), (cx + w / 2 - x0) * S, h * S);
  }

  const text = makeText(g, px, py);
  pinLabels(text);
  text('EN', 4.4, 25.3, 0.95);
  text('BOOT', 4.4, 3.1, 0.95);
  text('CP2102', 13.0, 5.9, 0.75, { color: 'rgba(246,247,249,.7)' });
  text('3V3 REG', 13.0, 24.1, 0.75, { color: 'rgba(246,247,249,.7)' });
  text('IO2', 19.4, 4.9, 0.8);
  text('PWR', 19.4, 23.4, 0.8);
  // 板名斜體大字放在 USB 與模組之間
  text('ESP32', 22.6, ESP_MID_Y + 1.2, 1.9, { weight: 800, italic: true, rot: -Math.PI / 2 });
  text('DEVKIT V1', 25.0, ESP_MID_Y + 1.2, 0.85, { weight: 600, color: 'rgba(246,247,249,.75)', rot: -Math.PI / 2 });

  g.strokeStyle = 'rgba(246,247,249,.22)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makeEsp32Bottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 57);
  // Box 的 -Y 面：u 仍沿 +x、v 方向相反，所以畫布上方 = 板子前緣（mm y = 0），左右不用對調
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // USB 固定腳焊點
  g.fillStyle = '#d7dbe0';
  for (const dy of [-3.6, 3.6]) g.fillRect(px(3.0), py(ESP_MID_Y + dy) - 0.7 * S, 1.2 * S, 1.4 * S);

  const text = makeText(g, px, py);
  // 背面的腳位標籤寫上 GPIO 編號，對照程式比較方便
  for (const p of ESP_PINS) {
    const [x, y] = pinMm(p);
    const far = y > ESP_MID_Y;
    const gpio = /^D\d+$/.test(p.id) ? p.id.slice(1) : p.label;
    // 背面的 y 沒有上下翻轉，文字方向和正面相反，所以對齊也要反過來，標籤才會朝板子內側長
    text(gpio, x, far ? y - 1.3 : y + 1.3, 0.95, { rot: -Math.PI / 2, align: far ? 'left' : 'right', weight: 600 });
  }
  text('ESP32 DEVKIT V1', 30, ESP_MID_Y + 2.4, 2.3, { weight: 800, italic: true });
  text('ROBOT LAB · 3.3V LOGIC', 30, ESP_MID_Y - 1.6, 1.0, { weight: 600, color: 'rgba(246,247,249,.75)' });
  text('GPIO 34-39: INPUT ONLY', 30, ESP_MID_Y - 4.0, 0.9, { weight: 600, color: 'rgba(255,196,80,.85)' });
  return finish(c);
}
