// 短音效：讀取 public/audio/sfx/*.mp3；檔案不存在或瀏覽器擋住時安靜失敗
export type SfxName = 'snap' | 'solder' | 'correct' | 'wrong' | 'levelup' | 'alarm' | 'click' | 'wire' | 'power' | 'badge';

const cache = new Map<SfxName, HTMLAudioElement>();
let enabled = true;
let duckHook: ((ms: number) => void) | null = null;

export function setSfxEnabled(v: boolean) { enabled = v; }
export function setDuckHook(fn: (ms: number) => void) { duckHook = fn; }

const VOL: Partial<Record<SfxName, number>> = { click: 0.35, wire: 0.6, snap: 0.7, levelup: 0.8, alarm: 0.65 };

export function sfx(name: SfxName) {
  if (!enabled || typeof Audio === 'undefined') return;
  try {
    let base = cache.get(name);
    if (!base) {
      base = new Audio(`${import.meta.env.BASE_URL}audio/sfx/${name}.mp3`);
      base.preload = 'auto';
      cache.set(name, base);
    }
    const a = base.cloneNode(true) as HTMLAudioElement;
    a.volume = VOL[name] ?? 0.7;
    if (name === 'alarm' || name === 'levelup') duckHook?.(name === 'alarm' ? 1600 : 1800);
    void a.play().catch(() => {});
  } catch {
    /* 忽略 */
  }
}
