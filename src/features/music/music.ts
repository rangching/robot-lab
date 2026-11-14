import { create } from 'zustand';
import { setDuckHook } from './sfx';

export interface Track { id: string; title: string; subtitle: string; file: string; bpm: number; duration?: number }

/** 預設曲目（tracks.json 讀不到時使用） */
const FALLBACK: Track[] = [
  { id: 'focus', title: '專注模式', subtitle: 'Lo-fi · 78 BPM', file: 'audio/focus.mp3', bpm: 78 },
  { id: 'debug', title: '深度除錯', subtitle: 'Ambient · 76 BPM', file: 'audio/debug.mp3', bpm: 76 },
  { id: 'sprint', title: '衝刺建構', subtitle: 'Synthwave · 100 BPM', file: 'audio/sprint.mp3', bpm: 100 },
];

interface MusicUi {
  tracks: Track[];
  playing: boolean;
  loading: boolean;
  track: string;
  volume: number;
  nudge: boolean;
  error: string | null;
}

export const useMusic = create<MusicUi>(() => ({ tracks: FALLBACK, playing: false, loading: false, track: 'focus', volume: 0.45, nudge: false, error: null }));

// ---------- Web Audio：AudioBufferSourceNode 才能做到無縫循環 ----------
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let duckNode: GainNode | null = null;
let current: { src: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
type PrefPatch = { track?: string; volume?: number; musicOn?: boolean; nudged?: boolean };
let prefs = {
  onChange: (_: PrefPatch) => {},
  get: (): { musicOn: boolean; nudged: boolean } => ({ musicOn: false, nudged: false }),
};

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    duckNode = ctx.createGain();
    master.gain.value = useMusic.getState().volume;
    master.connect(duckNode).connect(ctx.destination);
  }
  return ctx;
}

function load(t: Track): Promise<AudioBuffer> {
  let p = buffers.get(t.id);
  if (!p) {
    const c = ensureCtx();
    p = fetch(`${import.meta.env.BASE_URL}${t.file}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((b) => c.decodeAudioData(b));
    buffers.set(t.id, p);
    p.catch(() => buffers.delete(t.id));
  }
  return p;
}

async function start(id: string) {
  const c = ensureCtx();
  await c.resume();
  const t = useMusic.getState().tracks.find((x) => x.id === id) ?? useMusic.getState().tracks[0];
  useMusic.setState({ loading: true, track: t.id, error: null });
  try {
    const buf = await load(t);
    // 使用者在載入期間按了暫停或換曲
    const s = useMusic.getState();
    if (s.track !== t.id) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g).connect(master!);
    src.start();
    g.gain.setTargetAtTime(1, c.currentTime, 0.6);
    if (current) {
      const old = current;
      old.gain.gain.setTargetAtTime(0, c.currentTime, 0.4);
      setTimeout(() => { try { old.src.stop(); } catch { /* 已停止 */ } }, 2500);
    }
    current = { src, gain: g, id: t.id };
    useMusic.setState({ playing: true, loading: false });
  } catch {
    useMusic.setState({ loading: false, playing: false, error: '音樂載入失敗' });
  }
}

function stopNow() {
  if (current && ctx) {
    const old = current;
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { try { old.src.stop(); } catch { /* 已停止 */ } }, 1500);
  }
  current = null;
  useMusic.setState({ playing: false, loading: false });
}

export const music = {
  init(opts: { track: string; volume: number; onChange: typeof prefs.onChange; get: typeof prefs.get }) {
    prefs = { onChange: opts.onChange, get: opts.get };
    useMusic.setState({ track: opts.track, volume: opts.volume });
    fetch(`${import.meta.env.BASE_URL}audio/tracks.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Track[] | null) => { if (Array.isArray(j) && j.length) useMusic.setState({ tracks: j }); })
      .catch(() => {});
    setDuckHook((ms) => music.duck(ms));
  },
  play(id?: string) {
    const t = id ?? useMusic.getState().track;
    prefs.onChange({ track: t, musicOn: true, nudged: true });
    useMusic.setState({ nudge: false });
    void start(t);
  },
  pause() {
    prefs.onChange({ musicOn: false });
    stopNow();
  },
  toggle() {
    if (useMusic.getState().playing || useMusic.getState().loading) music.pause();
    else music.play();
  },
  select(id: string) {
    if (useMusic.getState().playing || useMusic.getState().loading) music.play(id);
    else {
      useMusic.setState({ track: id });
      prefs.onChange({ track: id });
    }
  },
  setVolume(v: number) {
    useMusic.setState({ volume: v });
    prefs.onChange({ volume: v });
    if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  },
  /** 短路警報或升級時暫時壓低音樂 */
  duck(ms: number) {
    if (!duckNode || !ctx) return;
    const t = ctx.currentTime;
    duckNode.gain.cancelScheduledValues(t);
    duckNode.gain.setTargetAtTime(0.2, t, 0.05);
    duckNode.gain.setTargetAtTime(1, t + ms / 1000, 0.4);
  },
  /** 使用者開始做事（進入任務、按執行）時：音樂設定為開就自動播；從沒問過就跳出邀請 */
  nudgeOnActivity() {
    const s = useMusic.getState();
    if (s.playing || s.loading) return;
    const p = prefs.get();
    if (p.musicOn) music.play();
    else if (!p.nudged) useMusic.setState({ nudge: true });
  },
  dismissNudge() {
    useMusic.setState({ nudge: false });
    prefs.onChange({ nudged: true });
  },
};
