#!/usr/bin/env node
// =============================================================================
//  Cyber Robotics Lab — offline music & SFX synthesizer (pure Node, no deps)
//  Usage:  node tools/music/compose.mjs [--only focus,debug,sprint,sfx] [--no-verify]
//  Output: public/audio/{focus,debug,sprint}.mp3, public/audio/sfx/*.mp3,
//          public/audio/tracks.json   (temp WAVs in tools/music/out/)
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_TMP = path.join(__dirname, 'out');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const SFX_DIR = path.join(AUDIO_DIR, 'sfx');

function findBin(name) {
  const env = process.env[name.toUpperCase()];
  if (env) return env;
  for (const d of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  return name;
}
const FFMPEG = findBin('ffmpeg');
const FFPROBE = findBin('ffprobe');

const SR = 44100;
const TAU = Math.PI * 2;
const args = process.argv.slice(2);
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? new Set(args[i + 1].split(',')) : null;
})();
const VERIFY = !args.includes('--no-verify');
const want = (k) => !ONLY || ONLY.has(k);

// ---------------------------------------------------------------- utilities --
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const fromDb = (d) => Math.pow(10, d / 20);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function fadeTail(a, sec = 0.005) {
  const n = Math.min(a.length, Math.round(sec * SR));
  for (let k = 0; k < n; k++) a[a.length - 1 - k] *= k / n;
  return a;
}
function fadeHead(a, sec = 0.002) {
  const n = Math.min(a.length, Math.round(sec * SR));
  for (let k = 0; k < n; k++) a[k] *= k / n;
  return a;
}
function stereo(n) {
  return { L: new Float32Array(n), R: new Float32Array(n) };
}
function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

// polyBLEP residual for band-limited saw/square
function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// ------------------------------------------------------------------ filters --
function bqCoefs(type, f, q = 0.7071, gainDb = 0) {
  const w0 = (TAU * Math.min(f, SR * 0.49)) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'lowshelf': {
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq);
      a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq; break;
    }
    case 'highshelf': {
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq);
      a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq; break;
    }
    default: throw new Error('bq type ' + type);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function bq(x, c) {
  let z1 = 0, z2 = 0;
  const { b0, b1, b2, a1, a2 } = c;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    x[i] = y;
  }
  return x;
}
const filt = (x, type, f, q, g) => bq(x, bqCoefs(type, f, q, g));
function filtBus(bus, type, f, q, g) {
  const c = bqCoefs(type, f, q, g);
  bq(bus.L, c); bq(bus.R, c);
  return bus;
}

// Topology-preserving state-variable filter (stable under modulation)
class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.set(1000, 0.707); }
  set(fc, q) {
    const g = Math.tan((Math.PI * clamp(fc, 20, SR * 0.45)) / SR);
    const k = 1 / q;
    this.a1 = 1 / (1 + g * (g + k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  lp(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return v2;
  }
}

// --------------------------------------------------------------- effects -----
function freeverb(inL, inR, { room = 0.8, damp = 0.5, width = 1, wet = 1, predelay = 0.012 } = {}) {
  const n = inL.length;
  const pd = Math.round(predelay * SR);
  const inp = new Float32Array(n);
  for (let i = pd; i < n; i++) inp[i] = (inL[i - pd] + inR[i - pd]) * 0.015;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const fb = room * 0.28 + 0.7, d1 = damp * 0.4, d2 = 1 - d1;
  const chan = (spread) => {
    const acc = new Float32Array(n);
    for (const T of combT) {
      const len = T + spread, buf = new Float32Array(len);
      let idx = 0, fs = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        fs = y * d2 + fs * d1;
        buf[idx] = inp[i] + fs * fb;
        if (++idx >= len) idx = 0;
        acc[i] += y;
      }
    }
    for (const T of apT) {
      const len = T + spread, buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const bo = buf[idx], x = acc[i];
        acc[i] = bo - x;
        buf[idx] = x + bo * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
    return acc;
  };
  const l = chan(0), r = chan(23);
  const w1 = wet * 3 * (width / 2 + 0.5), w2 = wet * 3 * ((1 - width) / 2);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    out.L[i] = l[i] * w1 + r[i] * w2;
    out.R[i] = r[i] * w1 + l[i] * w2;
  }
  return out;
}

function pingPong(inL, inR, delaySec, fb = 0.4, lpHz = 3000, hpHz = 200) {
  const n = inL.length, d = Math.max(1, Math.round(delaySec * SR));
  const bL = new Float32Array(d), bR = new Float32Array(d);
  const out = stereo(n);
  const a = 1 - Math.exp((-TAU * lpHz) / SR), h = 1 - Math.exp((-TAU * hpHz) / SR);
  let idx = 0, lpL = 0, lpR = 0, hpL = 0, hpR = 0;
  for (let i = 0; i < n; i++) {
    const dl = bL[idx], dr = bR[idx];
    out.L[i] = dl; out.R[i] = dr;
    lpL += a * ((inL[i] + inR[i]) * 0.5 + dr * fb - lpL);
    lpR += a * (dl * fb - lpR);
    hpL += h * (lpL - hpL); hpR += h * (lpR - hpR);
    bL[idx] = lpL - hpL; bR[idx] = lpR - hpR;
    if (++idx >= d) idx = 0;
  }
  return out;
}

function dcBlock(x, fc = 8) {
  const R = Math.exp((-TAU * fc) / SR);
  let xp = 0, yp = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    yp = v - xp + R * yp;
    xp = v;
    x[i] = yp;
  }
}

// level-independent soft saturation: the bus peak is mapped to `peakIn` before
// tanh shaping and the original scale is restored afterwards
function saturate(bus, drive = 1.5, peakIn = 0.8) {
  const pk = peakOf(bus.L, bus.R);
  if (pk <= 0) return;
  const sc = peakIn / pk, k = Math.tanh(drive);
  for (const x of [bus.L, bus.R]) for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * sc * drive) / k / sc;
}

// ---------------------------------------------------------------- loudness ---
// ITU-R BS.1770-4 integrated loudness (K-weighting computed for 44.1 kHz)
function kWeight(x) {
  // stage 1: high shelf
  {
    const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    const K = Math.tan((Math.PI * f0) / SR), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    bq(x, { b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 });
  }
  // stage 2: RLB high-pass
  {
    const f0 = 38.13547087602444, Q = 0.5003270373238773;
    const K = Math.tan((Math.PI * f0) / SR), a0 = 1 + K / Q + K * K;
    bq(x, { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 });
  }
  return x;
}
function lufs(L, R) {
  const blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  let n = L.length;
  const pad = Math.max(n, blk);
  const kl = new Float32Array(pad), kr = new Float32Array(pad);
  kl.set(L); kr.set(R);
  kWeight(kl); kWeight(kr);
  n = pad;
  const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + kl[i] * kl[i] + kr[i] * kr[i];
  const zs = [];
  for (let s = 0; s + blk <= n; s += hop) zs.push((cs[s + blk] - cs[s]) / blk);
  const L_ = (z) => -0.691 + 10 * Math.log10(Math.max(z, 1e-20));
  const abs = zs.filter((z) => L_(z) > -70);
  if (!abs.length) return -70;
  const rel = L_(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const g = abs.filter((z) => L_(z) > rel);
  return L_(g.reduce((a, b) => a + b, 0) / g.length);
}
function peakOf(L, R) {
  let p = 0;
  for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return p;
}

// sliding min over the forward window [i, i+w-1] (van Herk / Gil-Werman)
function slidingMinFwd(x, w) {
  const n = x.length, pre = new Float32Array(n), suf = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) pre[i] = i % w === 0 ? x[i] : Math.min(pre[i - 1], x[i]);
  for (let i = n - 1; i >= 0; i--) suf[i] = i % w === w - 1 || i === n - 1 ? x[i] : Math.min(suf[i + 1], x[i]);
  for (let i = 0; i < n; i++) {
    const j = Math.min(i + w - 1, n - 1);
    out[i] = Math.min(suf[i], pre[j]);
  }
  return out;
}
// look-ahead peak limiter (no added latency: the gain curve is computed ahead)
function limiter(L, R, ceilDb = -1.5, lookMs = 4, relMs = 150) {
  const n = L.length, ceil = fromDb(ceilDb), la = Math.max(1, Math.round((lookMs * SR) / 1000));
  const req = new Float32Array(n);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    req[i] = p > ceil ? ceil / p : 1;
    if (p > ceil) hits++;
  }
  if (!hits) return 0;
  const fmin = slidingMinFwd(req, la + 1);
  const kr = Math.exp(-1 / ((relMs * SR) / 1000));
  let e = 1, acc = 0;
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = fmin[i];
    e = g < e ? g : g + (e - g) * kr;
    env[i] = e;
  }
  for (let i = 0; i < n; i++) {
    acc += env[i];
    if (i > la) acc -= env[i - la - 1];
    const g = acc / Math.min(i + 1, la + 1);
    L[i] *= g; R[i] *= g;
  }
  return hits;
}
// run a stereo processor on a loop as if it were circular (pre/post wrap context)
function circular(L, R, preSec, postSec, fn) {
  const n = L.length, pre = Math.round(preSec * SR), post = Math.round(postSec * SR);
  const eL = new Float32Array(pre + n + post), eR = new Float32Array(pre + n + post);
  eL.set(L.subarray(n - pre), 0); eR.set(R.subarray(n - pre), 0);
  eL.set(L, pre); eR.set(R, pre);
  eL.set(L.subarray(0, post), pre + n); eR.set(R.subarray(0, post), pre + n);
  const r = fn(eL, eR);
  L.set(eL.subarray(pre, pre + n)); R.set(eR.subarray(pre, pre + n));
  return r;
}

// ------------------------------------------------------------- instruments ---
// Rhodes-like FM electric piano (1:1 operator pair + short high "tine" bark)
function epiano(f, dur, vel, seed, { bright = 1, rel = 0.3 } = {}) {
  const rng = mulberry32(seed);
  const decay = 1.4 + 1.8 * Math.pow(220 / f, 0.5);
  const nOn = Math.round(dur * SR);
  const n = Math.min(nOn + Math.round(rel * 5 * SR), Math.round(decay * 8 * SR));
  const out = new Float32Array(n);
  const w = (TAU * f) / SR;
  let pc = rng() * TAU, pm = rng() * TAU, pt = 0;
  let eD = 1, eI = 1, eT = 1, r = 1;
  const kD = Math.exp(-1 / (decay * SR)), kI = Math.exp(-1 / (0.3 * SR)), kT = Math.exp(-1 / (0.016 * SR)), kR = Math.exp(-1 / (rel * SR));
  const I0 = (0.35 + 1.5 * vel) * bright, Is = 0.22 * bright;
  const tineRatio = f * 15 < 15000 ? 14 : f * 8 < 15000 ? 7 : 0;
  const It = tineRatio ? 0.7 * vel * bright : 0;
  const att = Math.round(0.0025 * SR);
  const amp = 0.3 + 0.7 * vel;
  for (let i = 0; i < n; i++) {
    if (i >= nOn) r *= kR;
    const idx = Is + I0 * eI;
    const tine = It * eT * Math.sin(pt);
    out[i] = Math.sin(pc + idx * Math.sin(pm) + tine) * eD * r * amp * (i < att ? i / att : 1);
    pc += w; pm += w; pt += w * tineRatio;
    eD *= kD; eI *= kI; eT *= kT;
  }
  return fadeTail(out, 0.01);
}

// warm sub bass: sine + low harmonics, gently saturated
function subBass(f, dur, vel, { rel = 0.07, harm = 0.28, sub = 0 } = {}) {
  const nOn = Math.round(dur * SR), n = nOn + Math.round(rel * 5 * SR);
  const out = new Float32Array(n), w = (TAU * f) / SR;
  const att = Math.round(0.012 * SR), kS = Math.exp(-1 / (0.5 * SR)), kR = Math.exp(-1 / (rel * SR));
  let ph = 0, s = 1, r = 1;
  const k = Math.tanh(1.4);
  for (let i = 0; i < n; i++) {
    if (i >= nOn) r *= kR;
    const e = (0.72 + 0.28 * s) * r * (i < att ? i / att : 1);
    const v = Math.sin(ph) + harm * Math.sin(2 * ph) + harm * 0.3 * Math.sin(3 * ph) + sub * Math.sin(ph * 0.5);
    out[i] = (Math.tanh(v * 1.4) / k) * e * vel;
    ph += w; s *= kS;
  }
  return fadeTail(out, 0.01);
}

// detuned PolyBLEP saw pad, stereo (voices spread across the field)
function sawPad(f, dur, vel, seed, { att = 1.5, rel = 1.5, voices = 3, detune = 9, spread = 0.75 } = {}) {
  const rng = mulberry32(seed);
  const nOn = Math.round(dur * SR), nAtt = Math.max(1, Math.round(att * SR));
  const n = nOn + Math.round(rel * 4.6 * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const kR = Math.exp(-1 / (rel * SR));
  const env = new Float32Array(n);
  {
    let r = 1;
    for (let i = 0; i < n; i++) {
      if (i >= nOn) r *= kR;
      const a = i < nAtt ? i / nAtt : 1;
      env[i] = a * a * (3 - 2 * a) * r * vel;
    }
  }
  for (let v = 0; v < voices; v++) {
    const c = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1; // -1..1
    const fr = f * Math.pow(2, (c * detune + (rng() - 0.5) * 2) / 1200);
    const dt = fr / SR;
    const [gl, gr] = panGains(c * spread);
    const g = 1 / Math.sqrt(voices);
    let p = rng();
    for (let i = 0; i < n; i++) {
      let s = 2 * p - 1 - blep(p, dt);
      p += dt; if (p >= 1) p -= 1;
      s *= env[i] * g;
      L[i] += s * gl; R[i] += s * gr;
    }
  }
  fadeTail(L, 0.02); fadeTail(R, 0.02);
  return { L, R };
}

// filtered pluck (saw + square) with resonant filter envelope
function pluck(f, dur, vel, seed, { cut = 1200, envAmt = 3, envTau = 0.07, decay = 0.25, q = 1.6, sq = 0.55, rel = 0.06 } = {}) {
  const rng = mulberry32(seed);
  const nOn = Math.round(dur * SR), n = nOn + Math.round(rel * 5 * SR);
  const out = new Float32Array(n), dt = f / SR;
  const svf = new SVF();
  let p = rng(), eA = 1, eF = 1, r = 1;
  const kA = Math.exp(-1 / (decay * SR)), kF = Math.exp(-1 / (envTau * SR)), kR = Math.exp(-1 / (rel * SR));
  const att = Math.round(0.002 * SR);
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) svf.set(cut * (1 + envAmt * eF * vel), q);
    if (i >= nOn) r *= kR;
    let saw = 2 * p - 1 - blep(p, dt);
    const p2 = p + 0.5 >= 1 ? p - 0.5 : p + 0.5;
    let sqr = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep(p2, dt);
    p += dt; if (p >= 1) p -= 1;
    const s = saw * (1 - sq) + sqr * sq;
    out[i] = svf.lp(s) * eA * r * vel * (i < att ? i / att : 1);
    eA *= kA; eF *= kF;
  }
  return fadeTail(out, 0.008);
}

// soft FM bell / blip
function bell(f, vel, seed, { ratio = 2.0, index = 1.2, decay = 1.2, idxDecay = 0.25, len } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round((len ?? decay * 5) * SR);
  const out = new Float32Array(n), w = (TAU * f) / SR;
  let pc = rng() * TAU, pm = 0, eA = 1, eI = 1;
  const kA = Math.exp(-1 / (decay * SR)), kI = Math.exp(-1 / (idxDecay * SR)), att = Math.round(0.003 * SR);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(pc + index * eI * Math.sin(pm)) * eA * vel * (i < att ? i / att : 1);
    pc += w; pm += w * ratio; eA *= kA; eI *= kI;
  }
  return fadeTail(out, 0.02);
}

// synthwave lead: two detuned saws, delayed vibrato, filter envelope
function leadSynth(f, dur, vel, seed, { rel = 0.18 } = {}) {
  const rng = mulberry32(seed);
  const nOn = Math.round(dur * SR), n = nOn + Math.round(rel * 5 * SR);
  const out = new Float32Array(n);
  const svf = new SVF();
  let p1 = rng(), p2 = rng(), p3 = rng(), vib = 0, r = 1, eF = 1, eD = 1;
  const kR = Math.exp(-1 / (rel * SR)), kF = Math.exp(-1 / (0.18 * SR)), kD = Math.exp(-1 / (0.35 * SR));
  const att = Math.round(0.014 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vd = clamp((t - 0.28) / 0.35, 0, 1) * 0.0065;
    const fm = 1 + vd * Math.sin(vib);
    vib += (TAU * 5.3) / SR;
    const dt1 = (f * fm * 1.0035) / SR, dt2 = (f * fm * 0.9965) / SR, dt3 = (f * fm * 0.5) / SR;
    if ((i & 15) === 0) svf.set(2200 + 2600 * eF, 0.85);
    if (i >= nOn) r *= kR;
    const s1 = 2 * p1 - 1 - blep(p1, dt1), s2 = 2 * p2 - 1 - blep(p2, dt2);
    const p3b = p3 + 0.5 >= 1 ? p3 - 0.5 : p3 + 0.5;
    const s3 = (p3 < 0.5 ? 1 : -1) + blep(p3, dt3) - blep(p3b, dt3);
    p1 += dt1; if (p1 >= 1) p1 -= 1;
    p2 += dt2; if (p2 >= 1) p2 -= 1;
    p3 += dt3; if (p3 >= 1) p3 -= 1;
    const e = (0.78 + 0.22 * eD) * r * (i < att ? i / att : 1);
    out[i] = svf.lp((s1 + s2) * 0.5 + s3 * 0.22) * e * vel;
    eF *= kF; eD *= kD;
  }
  return fadeTail(out, 0.01);
}

// synthwave bass: saw + sine sub through enveloped low-pass
function synthBass(f, dur, vel, seed, { cut = 200, envAmt = 1400, tau = 0.09, rel = 0.03 } = {}) {
  const rng = mulberry32(seed);
  const nOn = Math.round(dur * SR), n = nOn + Math.round(rel * 5 * SR);
  const out = new Float32Array(n), dt = f / SR;
  const svf = new SVF();
  let p = rng(), ps = 0, eF = 1, r = 1;
  const kF = Math.exp(-1 / (tau * SR)), kR = Math.exp(-1 / (rel * SR)), att = Math.round(0.003 * SR);
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) svf.set(cut + envAmt * eF * vel, 1.15);
    if (i >= nOn) r *= kR;
    const saw = 2 * p - 1 - blep(p, dt);
    p += dt; if (p >= 1) p -= 1;
    const sub = Math.sin(TAU * ps); ps += dt; if (ps >= 1) ps -= 1;
    out[i] = (svf.lp(saw) * 0.75 + sub * 0.55) * r * vel * (i < att ? i / att : 1);
    eF *= kF;
  }
  return fadeTail(out, 0.006);
}

// ------------------------------------------------------------------ drums ----
function noise(n, rng) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rng() * 2 - 1;
  return a;
}
function kick({ f0 = 110, f1 = 46, pTau = 0.032, decay = 0.26, click = 0.05, seed = 1, len = 0.8 } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round(len * SR), out = new Float32Array(n);
  let ph = 0, a = 1, pe = 1, ce = 1, lp = 0;
  const ka = Math.exp(-1 / (decay * SR)), kp = Math.exp(-1 / (pTau * SR)), kc = Math.exp(-1 / (0.0025 * SR));
  const la = 1 - Math.exp((-TAU * 2500) / SR), att = Math.round(0.0015 * SR);
  for (let i = 0; i < n; i++) {
    const f = f1 + (f0 - f1) * pe;
    lp += la * (rng() * 2 - 1 - lp);
    out[i] = (Math.sin(TAU * ph) * a + lp * ce * click) * (i < att ? i / att : 1);
    ph += f / SR; pe *= kp; a *= ka; ce *= kc;
  }
  return fadeTail(out, 0.02);
}
function snare({ tone = 190, decay = 0.13, body = 0.45, bp = 1900, lp = 6500, seed = 1, len = 0.55 } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round(len * SR);
  const nz = noise(n, rng);
  const kN = Math.exp(-1 / (decay * SR));
  let e = 1;
  for (let i = 0; i < n; i++) { nz[i] *= e; e *= kN; }
  filt(nz, 'bp', bp, 0.6); filt(nz, 'lp', lp, 0.7); filt(nz, 'hp', 300, 0.7);
  const out = new Float32Array(n);
  let ph = 0, eb = 1;
  const kB = Math.exp(-1 / (0.055 * SR));
  const att = Math.round(0.001 * SR);
  for (let i = 0; i < n; i++) {
    const f = tone * (1 + 0.25 * eb);
    out[i] = (nz[i] * 2.2 + Math.sin(ph) * eb * body) * (i < att ? i / att : 1);
    ph += (TAU * f) / SR; eb *= kB;
  }
  return fadeTail(out, 0.03);
}
function hat({ decay = 0.035, hp = 7000, lp = 11000, seed = 1, len } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round((len ?? decay * 7) * SR);
  const out = noise(n, rng);
  const k = Math.exp(-1 / (decay * SR)), att = Math.round(0.0008 * SR);
  let e = 1;
  for (let i = 0; i < n; i++) { out[i] *= e * (i < att ? i / att : 1); e *= k; }
  filt(out, 'hp', hp, 0.7); filt(out, 'hp', hp, 0.7); filt(out, 'lp', lp, 0.7);
  return fadeTail(out, 0.005);
}
function rim({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round(0.12 * SR), out = noise(n, rng);
  const k = Math.exp(-1 / (0.012 * SR));
  let e = 1, ph = 0;
  for (let i = 0; i < n; i++) { out[i] = out[i] * e * 0.6 + Math.sin(ph) * e; ph += (TAU * 1650) / SR; e *= k; }
  filt(out, 'bp', 1700, 1.2);
  return fadeTail(fadeHead(out, 0.0008), 0.01);
}
function clap({ seed = 1, decay = 0.13 } = {}) {
  const rng = mulberry32(seed);
  const n = Math.round(0.6 * SR), out = new Float32Array(n);
  const bursts = [0, 0.0105, 0.021, 0.031];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (let b = 0; b < 3; b++) if (t >= bursts[b]) e += Math.exp(-(t - bursts[b]) / 0.0045) * (b === 2 ? 1 : 0.8);
    if (t >= bursts[3]) e += 0.9 * Math.exp(-(t - bursts[3]) / decay);
    out[i] = (rng() * 2 - 1) * e;
  }
  filt(out, 'bp', 1250, 0.9); filt(out, 'hp', 500, 0.7); filt(out, 'lp', 7000, 0.7);
  return fadeTail(fadeHead(out, 0.001), 0.03);
}

// ------------------------------------------------------------- song engine ---
// Each song is rendered with W seconds of "previous loop" warm-up followed by
// exactly one loop. Every event is placed twice (in the loop and one loop
// earlier), so reverb/delay/release tails from the end of the loop are
// already present at the start: the extracted loop is seamless by design.
class Song {
  constructor(name, { bpm, bars, seed, warm = 24 }) {
    this.name = name; this.bpm = bpm; this.bars = bars;
    this.beatSec = 60 / bpm; this.barSec = this.beatSec * 4;
    this.loopSec = this.barSec * bars;
    this.N = Math.round(this.loopSec * SR);
    this.W = Math.round(warm * SR);
    this.len = this.W + this.N;
    this.buses = {};
    this.rng = mulberry32(seed);
  }
  T(bar, beat = 0) { return bar * this.barSec + beat * this.beatSec; }
  seed() { return (this.rng() * 4294967296) >>> 0; }
  r() { return this.rng(); }
  tl(i) { let t = ((i - this.W) / SR) % this.loopSec; if (t < 0) t += this.loopSec; return t; }
  bus(name) { return (this.buses[name] ??= stereo(this.len)); }
  add(name, t, mono, pan = 0, gain = 1) {
    const [gl, gr] = panGains(pan);
    this.addSt(name, t, mono, mono, gain * gl, gain * gr);
  }
  addSt(name, t, L, R, gl = 1, gr = gl) {
    const b = this.bus(name);
    const n = this.len;
    t %= this.loopSec;
    if (t < 0) t += this.loopSec;
    for (const off of [this.W, this.W - this.N]) {
      const s0 = Math.round(t * SR) + off;
      const a = Math.max(0, -s0), e = Math.min(L.length, n - s0);
      for (let k = a; k < e; k++) { b.L[s0 + k] += L[k] * gl; b.R[s0 + k] += R[k] * gr; }
    }
  }
  // piecewise-linear automation over bars -> f(loopSeconds)
  auto(points) {
    const pts = points.map(([b, v]) => [b * this.barSec, v]);
    return (t) => {
      if (t <= pts[0][0]) return pts[0][1];
      for (let k = 1; k < pts.length; k++) {
        if (t <= pts[k][0]) {
          const [t0, v0] = pts[k - 1], [t1, v1] = pts[k];
          return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1);
        }
      }
      return pts[pts.length - 1][1];
    };
  }
  // loop-periodic LFO (integer number of cycles per loop), approx `hz`
  lfo(hz, phase = 0) {
    const k = Math.max(1, Math.round(hz * this.loopSec));
    return (t) => Math.sin((TAU * k * t) / this.loopSec + phase);
  }
  // per-sample stereo gain driven by loop time; slow(t) evaluated every 64 samples
  gain(name, fn, slow = () => 0) {
    const b = this.bus(name);
    let t = this.tl(0), sv = slow(t);
    const dt = 1 / SR, L = this.loopSec;
    for (let i = 0; i < this.len; i++) {
      if ((i & 63) === 0) sv = slow(t);
      const g = fn(t, sv);
      b.L[i] *= g; b.R[i] *= g;
      t += dt; if (t >= L) t -= L;
    }
  }
  // time-varying low-pass driven by loop time
  lowpassAuto(name, fcFn, q = 0.707) {
    const b = this.bus(name);
    for (const x of [b.L, b.R]) {
      const svf = new SVF();
      let t = this.tl(0);
      const dt = 1 / SR, L = this.loopSec;
      for (let i = 0; i < this.len; i++) {
        if ((i & 31) === 0) svf.set(fcFn(t), q);
        x[i] = svf.lp(x[i]);
        t += dt; if (t >= L) t -= L;
      }
    }
  }
  rmsReport() {
    const out = {};
    for (const [k, b] of Object.entries(this.buses)) {
      let s = 0;
      for (let i = this.W; i < this.len; i++) s += b.L[i] * b.L[i] + b.R[i] * b.R[i];
      // gated RMS: mean power over 400 ms blocks that are not near-silent
      const blk = Math.round(0.4 * SR);
      let gs = 0, gn = 0, pk = 0;
      for (let a = this.W; a + blk <= this.len; a += blk) {
        let e = 0;
        for (let i = a; i < a + blk; i++) { e += b.L[i] * b.L[i] + b.R[i] * b.R[i]; pk = Math.max(pk, Math.abs(b.L[i]), Math.abs(b.R[i])); }
        e /= 2 * blk;
        if (e > 1e-7) { gs += e; gn++; }
      }
      out[k] = `rms ${dB(Math.sqrt(s / (2 * this.N))).toFixed(1)} active ${dB(Math.sqrt(gs / Math.max(1, gn))).toFixed(1)} pk ${dB(pk).toFixed(1)}`;
    }
    return out;
  }
}

function mixInto(dst, src, g = 1) {
  for (let i = 0; i < dst.L.length; i++) { dst.L[i] += src.L[i] * g; dst.R[i] += src.R[i] * g; }
}
function sendTo(song, dstName, srcName, g) {
  mixInto(song.bus(dstName), song.bus(srcName), g);
}

// common finishing: returns the extracted, normalized loop {L,R}
function master(song, mix, { target = -18, ceil = -1.5 } = {}) {
  dcBlock(mix.L); dcBlock(mix.R);
  const L = mix.L.slice(song.W, song.W + song.N), R = mix.R.slice(song.W, song.W + song.N);
  let g = fromDb(target - lufs(L, R));
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  let hits = 0;
  for (let pass = 0; pass < 3; pass++) {
    hits = circular(L, R, 0.5, 0.05, (a, b) => limiter(a, b, ceil));
    const lu = lufs(L, R);
    if (Math.abs(lu - target) < 0.15) break;
    g = fromDb(target - lu);
    for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  }
  return { L, R, limiterHits: hits };
}

// ===================================================================== FOCUS =
// Lo-fi hip-hop, 78 BPM, D major (jazzy 7th/9th voicings on FM Rhodes)
function songFocus() {
  const s = new Song('focus', { bpm: 78, bars: 64, seed: 0x10f1 });
  const progA = [
    { bass: 43, v: [59, 62, 66, 69] }, // Gmaj9   (B D F# A)
    { bass: 42, v: [57, 61, 64, 69] }, // F#m7    (A C# E A)
    { bass: 40, v: [55, 59, 62, 66] }, // Em9     (G B D F#)
    { bass: 45, v: [55, 61, 66, 71] }, // A13     (G C# F# B)
  ];
  const progB = [
    { bass: 47, v: [62, 66, 69, 73] }, // Bm9     (D F# A C#)
    { bass: 43, v: [59, 62, 66, 69] }, // Gmaj9
    { bass: 40, v: [55, 59, 62, 66] }, // Em9
    { bass: 42, v: [58, 64, 67, 73] }, // F#7b9   (A# E G C#)
  ];
  const sec = (bar) => (bar < 8 ? 'intro' : bar < 24 ? 'A' : bar < 40 ? 'B' : bar < 48 ? 'half' : bar < 60 ? 'A2' : 'outro');
  // swing: offbeat 8ths late (≈58%), 16ths proportionally
  const sw = (beat) => {
    const b = Math.floor(beat), f = beat - b;
    const m = { 0: 0, 0.25: 0.29, 0.5: 0.58, 0.75: 0.79 };
    return b + (m[Math.round(f * 4) / 4] ?? f);
  };
  const hum = () => (s.r() - 0.5) * 0.008;

  for (let bar = 0; bar < 64; bar++) {
    const S = sec(bar);
    const ch = (S === 'B' ? progB : progA)[bar % 4];
    // ---- keys comping
    let hits;
    if (S === 'intro' || S === 'outro' || S === 'half') hits = [[0, 3.85, 0.62]];
    else if (S === 'B') hits = bar % 2 ? [[0, 2.3, 0.72], [2.5, 1.35, 0.5]] : [[0, 1.4, 0.7], [1.5, 0.9, 0.46], [2.5, 1.35, 0.55]];
    else hits = bar % 2 ? [[0, 3.85, 0.68]] : [[0, 2.3, 0.72], [2.5, 1.35, 0.5]];
    for (const [beat, durB, vel] of hits) {
      const t0 = s.T(bar, sw(beat)) + hum();
      ch.v.forEach((m, k) => {
        const off = k * 0.013 + s.r() * 0.006;
        const v = vel * (0.86 + 0.14 * s.r()) * (k === ch.v.length - 1 ? 1.08 : 1);
        s.add('keys', t0 + off, epiano(mtof(m), durB * s.beatSec - off, v, s.seed()), (k - 1.5) * 0.22);
      });
    }
    // ---- bass
    const bf = mtof(ch.bass);
    if (S === 'intro' || S === 'outro') {
      s.add('bass', s.T(bar), subBass(bf, s.barSec * 0.95, 0.55, { harm: 0.15, sub: 0.45 }));
    } else {
      s.add('bass', s.T(bar) + 0.006, subBass(bf, s.beatSec * 2.25, 0.8, { harm: 0.15, sub: 0.45 }));
      const second = S === 'B' && bar % 2 ? mtof(ch.bass - 5) : bf;
      s.add('bass', s.T(bar, sw(2.5)) + 0.006, subBass(second, s.beatSec * 1.3, 0.62, { harm: 0.15, sub: 0.45 }));
    }
    // ---- drums
    const full = S === 'A' || S === 'B' || S === 'A2';
    const hatVel = S === 'intro' ? (bar < 4 ? 0 : 0.35) : S === 'outro' ? 0.4 : 0.6;
    if (hatVel > 0) {
      for (let e = 0; e < 8; e++) {
        const beat = e * 0.5;
        const v = hatVel * (e % 2 ? 0.55 : 0.9) * (0.85 + 0.3 * s.r());
        s.add('drums', s.T(bar, sw(beat)) + hum(), hat({ decay: e % 2 ? 0.028 : 0.04, seed: s.seed(), lp: 9000 }), 0.25, v);
      }
      if (full && s.r() < 0.45) s.add('drums', s.T(bar, sw(3.75)) + hum(), hat({ decay: 0.022, seed: s.seed(), lp: 9000 }), 0.3, 0.22);
    }
    if (full) {
      const kicks = bar % 4 === 3 ? [0, 1.75, 2.5] : [0, 2.5];
      for (const kb of kicks) s.add('drums', s.T(bar, sw(kb)) + hum(), kick({ seed: s.seed(), f0: 95, f1: 47, decay: 0.24 }), 0, kb === 0 ? 0.95 : 0.75);
      for (const sb of [1, 3]) {
        const sn = snare({ seed: s.seed(), decay: 0.12, lp: 5200 });
        s.add('drums', s.T(bar, sb) + 0.018 + hum(), sn, -0.08, 0.62 * (0.9 + 0.2 * s.r()));
      }
    } else if (S === 'half') {
      s.add('drums', s.T(bar, 0) + hum(), kick({ seed: s.seed(), f0: 90, f1: 46, decay: 0.22 }), 0, 0.6);
      for (const sb of [1, 3]) s.add('drums', s.T(bar, sb) + 0.015 + hum(), rim({ seed: s.seed() }), -0.15, 0.3);
    } else if (S === 'outro' && bar < 62) {
      s.add('drums', s.T(bar, 0) + hum(), kick({ seed: s.seed(), f0: 90, f1: 46, decay: 0.22 }), 0, 0.5);
    }
  }

  // ---- melody phrases [barOffset, beat, durBeats, midi]
  const M1 = [[0, 1, 0.5, 71], [0, 1.5, 0.5, 74], [0, 2, 1.5, 78], [1, 0, 1, 76], [1, 1.5, 0.5, 73], [1, 2, 1.5, 69],
    [2, 1, 0.5, 67], [2, 1.5, 0.5, 71], [2, 2, 0.5, 74], [2, 2.5, 1.5, 78], [3, 0, 2, 76], [3, 2.5, 1, 73]];
  const M2 = [[0, 0, 1.5, 81], [0, 1.5, 0.5, 78], [0, 2, 1, 74], [1, 0.5, 1, 73], [1, 1.5, 1.5, 69],
    [2, 0, 1, 71], [2, 1, 0.5, 74], [2, 1.5, 0.5, 76], [2, 2, 2, 78], [3, 0.5, 1, 76], [3, 1.5, 0.5, 73], [3, 2, 1.5, 69]];
  const M3 = [[0, 0, 1, 78], [0, 1, 0.5, 74], [0, 1.5, 1.5, 73], [1, 0.5, 1, 71], [1, 1.5, 0.5, 74], [1, 2, 1.5, 78],
    [2, 0, 1, 79], [2, 1, 0.5, 78], [2, 1.5, 0.5, 76], [2, 2, 1.5, 74], [3, 0, 1, 73], [3, 1, 1.5, 70]];
  const play = (bar0, ph, vel = 0.5) => {
    for (const [bo, beat, dur, m] of ph) {
      const t = s.T(bar0 + bo, sw(beat)) + hum();
      s.add('mel', t, epiano(mtof(m), dur * s.beatSec * 0.95, vel * (0.85 + 0.2 * s.r()), s.seed(), { bright: 0.75 }), 0.12);
    }
  };
  play(28, M3); play(36, M3, 0.46); play(40, M1, 0.45); play(44, M2, 0.42); play(52, M2, 0.48);

  // ---- vinyl: loop-periodic hiss + seeded crackle events
  {
    const b = s.bus('vinyl');
    const rng = mulberry32(0xc4ac);
    const hiss = noise(s.N, rng);
    for (let i = 0; i < s.len; i++) {
      const j = (((i - s.W) % s.N) + s.N) % s.N;
      b.L[i] = hiss[j] * 0.05; b.R[i] = hiss[(j + 7919) % s.N] * 0.05;
    }
    const nPops = Math.round(s.loopSec * 9);
    for (let k = 0; k < nPops; k++) {
      const t = rng() * s.loopSec;
      const big = rng() < 0.06;
      const a = (big ? 0.6 : 0.12 + 0.25 * rng()) * (rng() < 0.5 ? -1 : 1);
      const len = big ? 40 : 12;
      const pop = new Float32Array(len);
      for (let i = 0; i < len; i++) pop[i] = a * Math.exp(-i / (big ? 6 : 2)) * (i % 2 ? -0.6 : 1);
      s.add('vinyl', t, pop, (rng() - 0.5) * 0.8);
    }
    filtBus(b, 'hp', 900, 0.7); filtBus(b, 'lp', 6500, 0.7);
  }

  // ---- bus processing
  const keys = s.bus('keys');
  const trem = s.lfo(s.bpm / 60 * 1.5); // dotted-8th autopan
  {
    let t = s.tl(0);
    for (let i = 0; i < s.len; i++) {
      const v = trem(t) * 0.12;
      keys.L[i] *= 1 - v; keys.R[i] *= 1 + v;
      t += 1 / SR; if (t >= s.loopSec) t -= s.loopSec;
    }
  }
  const keyCut = s.auto([[0, 2300], [8, 3300], [24, 3800], [40, 2800], [48, 3600], [60, 2700], [64, 2300]]);
  s.lowpassAuto('keys', keyCut, 0.65);
  filtBus(keys, 'hp', 120, 0.7);
  saturate(keys, 1.2, 0.7);
  filtBus(s.bus('mel'), 'lp', 4200, 0.7);
  filtBus(s.bus('bass'), 'lp', 600, 0.7);
  const drums = s.bus('drums');
  filtBus(drums, 'lowshelf', 120, 0.7, 1.5);
  saturate(drums, 1.5, 0.9);
  filtBus(drums, 'lp', 9500, 0.7);

  const mix = stereo(s.len);
  const G = { keys: 0.55, mel: 0.9, bass: 0.75, drums: 0.85, vinyl: 0.45 };
  for (const [k, g] of Object.entries(G)) mixInto(mix, s.bus(k), g);
  // delay on melody
  const mel = s.bus('mel');
  const dly = pingPong(mel.L, mel.R, s.beatSec * 0.75, 0.38, 2600, 300);
  mixInto(mix, dly, 0.22);
  // reverb send
  const send = stereo(s.len);
  mixInto(send, keys, 0.3); mixInto(send, mel, 0.4); mixInto(send, drums, 0.12); mixInto(send, dly, 0.3);
  filtBus(send, 'hp', 250, 0.7); filtBus(send, 'lp', 5000, 0.7);
  mixInto(mix, freeverb(send.L, send.R, { room: 0.78, damp: 0.6, width: 0.9 }), 0.55);
  // tape wobble (loop-periodic modulated delay) + gentle tape tone
  {
    const wow = s.lfo(0.55), flut = s.lfo(4.2, 1.3);
    const base = 0.006 * SR;
    const out = stereo(s.len);
    let t = s.tl(0);
    for (let i = 0; i < s.len; i++) {
      const d = base + (0.0011 * wow(t) + 0.00004 * flut(t)) * SR;
      const p = i - d, i0 = Math.floor(p), fr = p - i0;
      if (i0 >= 0) {
        out.L[i] = mix.L[i0] * (1 - fr) + mix.L[i0 + 1] * fr;
        out.R[i] = mix.R[i0] * (1 - fr) + mix.R[i0 + 1] * fr;
      }
      t += 1 / SR; if (t >= s.loopSec) t -= s.loopSec;
    }
    mix.L.set(out.L); mix.R.set(out.R);
  }
  filtBus(mix, 'lp', 11500, 0.6);
  filtBus(mix, 'hp', 28, 0.7);
  return { song: s, mix };
}

// ===================================================================== DEBUG =
// Ambient electronic, no drums. A minor / Dorian colour, 76 BPM grid.
function songDebug() {
  const s = new Song('debug', { bpm: 76, bars: 64, seed: 0xdeb6 });
  const chords = [
    { root: 45, pad: [57, 60, 64, 67, 71], arp: [69, 72, 76, 79, 83] }, // Am9
    { root: 41, pad: [53, 57, 60, 64, 71], arp: [65, 69, 72, 76, 83] }, // Fmaj7#11
    { root: 36, pad: [55, 59, 62, 64, 67], arp: [67, 71, 72, 74, 76] }, // Cmaj9 (6/9 colour)
    { root: 38, pad: [53, 57, 60, 64, 69], arp: [65, 69, 72, 74, 76] }, // Dm9
  ];
  const chordAt = (bar) => chords[Math.floor(bar / 4) % 4];

  // ---- pads: one chord per 4 bars, long swells
  for (let c = 0; c < 16; c++) {
    const bar = c * 4, ch = chordAt(bar);
    const t = s.T(bar) - 0.6;
    for (const m of ch.pad) {
      const v = 0.32 * (0.9 + 0.2 * s.r());
      const { L, R } = sawPad(mtof(m), s.barSec * 4 + 0.6, v, s.seed(), { att: 2.6, rel: 1.8, voices: 3, detune: 7, spread: 0.85 });
      s.addSt('pad', t, L, R);
    }
    // soft bass root in the middle sections
    if (bar >= 16 && bar < 56) s.add('bass', s.T(bar), subBass(mtof(ch.root - 12), s.barSec * 3.9, 0.5, { rel: 0.8, harm: 0.15 }));
  }

  // ---- drone: loop-periodic A1 + E2 with slow breathing
  {
    const b = s.bus('drone');
    const per = (f) => Math.round(f * s.loopSec) / s.loopSec;
    const fs = [[per(55), 0.55], [per(55.13), 0.16], [per(82.41), 0.22], [per(110.07), 0.08]];
    const breath = s.lfo(1 / 25), pan = s.lfo(1 / 40, 0.7);
    const amp = s.auto([[0, 0.9], [16, 0.75], [32, 0.6], [48, 0.8], [64, 0.9]]);
    for (let i = 0; i < s.len; i++) {
      const t = s.tl(i);
      let v = 0;
      for (const [f, a] of fs) v += a * Math.sin(TAU * f * t);
      v *= (0.75 + 0.25 * breath(t)) * amp(t) * 0.5;
      const p = 0.25 * pan(t);
      b.L[i] = v * (1 - p); b.R[i] = v * (1 + p);
    }
  }

  // ---- data-blink arpeggio (16ths)
  const patA = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 3, 2, 1];
  const patB = [4, -1, 2, 0, 3, -1, 1, 4, 2, -1, 0, 3, 4, 1, -1, 2];
  const density = s.auto([[0, 0], [8, 0], [9, 0.3], [16, 0.45], [20, 0.85], [32, 0.8], [48, 0.7], [52, 0.35], [56, 0], [64, 0]]);
  const arpGain = s.auto([[0, 0], [8, 0], [12, 0.8], [16, 0.9], [32, 1], [48, 0.9], [54, 0.5], [56, 0], [64, 0]]);
  const arpCut = s.auto([[0, 700], [16, 900], [24, 1500], [32, 2200], [44, 2600], [48, 1600], [56, 900], [64, 700]]);
  for (let bar = 8; bar < 56; bar++) {
    const ch = chordAt(bar), pat = bar >= 32 && bar < 48 ? patB : patA;
    for (let st = 0; st < 16; st++) {
      const t = s.T(bar, st / 4);
      const d = density(t), g = arpGain(t);
      const idx = pat[st];
      const roll = s.r(), oct = s.r();
      if (idx < 0 || roll > d || g <= 0) continue;
      const m = ch.arp[idx] + (oct < 0.12 ? 12 : 0);
      const accent = st % 4 === 0 ? 1 : 0.7;
      const v = g * accent * (0.75 + 0.25 * s.r()) * 0.35;
      s.add('arp', t, pluck(mtof(m), s.beatSec * 0.2, v, s.seed(), { cut: arpCut(t), envAmt: 2.2, envTau: 0.06, decay: 0.2, q: 2.2, sq: 0.6 }), (s.r() - 0.5) * 0.6);
    }
  }

  // ---- blips (sparse high bells, A minor pentatonic)
  const pent = [81, 84, 86, 88, 91];
  const blipP = s.auto([[0, 0.06], [16, 0.14], [32, 0.22], [48, 0.1], [64, 0.06]]);
  for (let bar = 0; bar < 64; bar++) {
    for (let b = 0; b < 4; b++) {
      const t = s.T(bar, b + (s.r() < 0.5 ? 0 : 0.5));
      const pick = s.r(), pp = s.r(), vv = s.r();
      if (pp > blipP(t)) continue;
      const m = pent[Math.floor(pick * pent.length)];
      s.add('blip', t, bell(mtof(m), 0.12 + 0.1 * vv, s.seed(), { ratio: 3.0, index: 0.9, decay: 0.9, idxDecay: 0.08 }), (s.r() - 0.5) * 1.4);
    }
  }

  // ---- sub pulse in the third section (bars 32-47): soft half-note heartbeat
  for (let bar = 32; bar < 48; bar++) {
    const ch = chordAt(bar);
    for (const b of [0, 2]) {
      const v = 0.38 * (bar < 34 ? (bar - 32 + b / 4 + 0.5) / 2 : bar >= 46 ? (48 - bar - b / 4) / 2 : 1);
      s.add('pulse', s.T(bar, b), subBass(mtof(ch.root - 12), s.beatSec * 0.7, v, { rel: 0.25, harm: 0.4 }));
    }
  }

  // ---- bus processing
  const padCut = s.auto([[0, 650], [16, 1000], [32, 1700], [44, 1800], [56, 900], [64, 650]]);
  const padLfo = s.lfo(1 / 19);
  s.lowpassAuto('pad', (t) => padCut(t) * (1 + 0.18 * padLfo(t)), 0.8);
  filtBus(s.bus('pad'), 'hp', 110, 0.7);
  filtBus(s.bus('drone'), 'lp', 300, 0.7);
  filtBus(s.bus('bass'), 'lp', 300, 0.7);
  filtBus(s.bus('pulse'), 'lp', 260, 0.7);
  filtBus(s.bus('blip'), 'lp', 7000, 0.7);

  const mix = stereo(s.len);
  const G = { pad: 0.5, drone: 0.42, arp: 1.4, blip: 0.69, bass: 0.35, pulse: 0.5 };
  for (const [k, g] of Object.entries(G)) mixInto(mix, s.bus(k), g);
  const arp = s.bus('arp');
  const dly = pingPong(arp.L, arp.R, s.beatSec * 0.75, 0.5, 2200, 300);
  mixInto(mix, dly, 0.32);
  const bl = s.bus('blip');
  const dly2 = pingPong(bl.L, bl.R, s.beatSec * 1.5, 0.45, 4000, 400);
  mixInto(mix, dly2, 0.12);
  const send = stereo(s.len);
  mixInto(send, s.bus('pad'), 0.55); mixInto(send, arp, 0.45); mixInto(send, dly, 0.4); mixInto(send, bl, 0.5);
  filtBus(send, 'hp', 200, 0.7); filtBus(send, 'lp', 6000, 0.7);
  mixInto(mix, freeverb(send.L, send.R, { room: 0.92, damp: 0.45, width: 1, predelay: 0.03 }), 0.6);
  filtBus(mix, 'hp', 28, 0.7);
  return { song: s, mix };
}

// ==================================================================== SPRINT =
// Synthwave, 100 BPM, A minor. i-VI-III-VII and VI-VII-v-i progressions.
function songSprint() {
  const s = new Song('sprint', { bpm: 100, bars: 80, seed: 0x5917 });
  const progA = [
    { bass: 33, pad: [57, 60, 64, 69, 71] }, // Am(add9)
    { bass: 29, pad: [57, 60, 65, 69, 72] }, // F
    { bass: 36, pad: [55, 60, 64, 67, 72] }, // C
    { bass: 31, pad: [55, 59, 62, 67, 71] }, // G
  ];
  const progB = [
    { bass: 29, pad: [57, 60, 65, 69, 72] }, // F
    { bass: 31, pad: [55, 59, 62, 67, 71] }, // G
    { bass: 28, pad: [55, 59, 64, 67, 71] }, // Em
    { bass: 33, pad: [57, 60, 64, 69, 72] }, // Am
  ];
  const sec = (bar) => (bar < 8 ? 'intro' : bar < 24 ? 'A' : bar < 32 ? 'lead' : bar < 40 ? 'A2' : bar < 48 ? 'break' : bar < 64 ? 'B' : bar < 72 ? 'lead2' : 'outro');
  const isB = (S) => S === 'break' || S === 'B';
  const groove = (bar) => { const S = sec(bar); return S === 'A' || S === 'lead' || S === 'A2' || S === 'B' || S === 'lead2' || (S === 'outro' && bar < 76); };

  for (let bar = 0; bar < 80; bar++) {
    const S = sec(bar);
    const ch = (isB(S) ? progB : progA)[bar % 4];
    // ---- pads (one note-set per bar, legato)
    const smooth = S === 'intro' || S === 'break' || (S === 'outro' && bar >= 76);
    for (const m of ch.pad) {
      const { L, R } = sawPad(mtof(m), s.barSec + 0.05, 0.3, s.seed(), { att: smooth ? 0.35 : 0.04, rel: smooth ? 0.9 : 0.35, voices: 3, detune: 10, spread: 0.8 });
      s.addSt('pad', s.T(bar), L, R);
    }
    // ---- bass: 8th-note octave pattern, sustained in the breakdown
    const bf = mtof(ch.bass);
    if (S === 'break') {
      s.add('bass', s.T(bar), synthBass(bf, s.barSec * 0.97, 0.7, s.seed(), { cut: 160, envAmt: 500, tau: 0.4, rel: 0.1 }));
    } else {
      const lvl = S === 'intro' ? 0.45 + 0.05 * bar : S === 'outro' && bar >= 76 ? 0.55 : 0.8;
      for (let e = 0; e < 8; e++) {
        const f = e % 2 ? bf * 2 : bf;
        const v = lvl * (e % 2 ? 0.8 : 1) * (0.92 + 0.08 * s.r());
        s.add('bass', s.T(bar, e * 0.5), synthBass(f, s.beatSec * 0.42, v, s.seed(), { cut: S === 'intro' ? 140 : 190, envAmt: S === 'intro' ? 700 : 1300 }));
      }
    }
    // ---- drums
    if (groove(bar)) {
      for (let b = 0; b < 4; b++) s.add('kick', s.T(bar, b), kick({ seed: s.seed(), f0: 125, f1: 48, decay: 0.22, pTau: 0.028, click: 0.07 }), 0, 0.9);
      for (const b of [1, 3]) s.add('drums', s.T(bar, b) + 0.004, clap({ seed: s.seed() }), 0.05, 1.5);
      for (let e = 0; e < 4; e++) s.add('drums', s.T(bar, e + 0.5), hat({ decay: 0.075, hp: 6500, lp: 10500, seed: s.seed() }), 0.2, 0.6);
    }
    const hat16 = S === 'intro' ? (bar >= 4 ? 0.32 : 0) : S === 'break' ? 0 : S === 'outro' && bar >= 76 ? 0.32 : 0.42;
    if (hat16 > 0) {
      for (let st = 0; st < 16; st++) {
        const v = hat16 * (st % 4 === 2 ? 0.4 : st % 2 ? 0.75 : 1) * (0.85 + 0.3 * s.r());
        s.add('drums', s.T(bar, st / 4), hat({ decay: 0.02, hp: 8000, lp: 12000, seed: s.seed() }), -0.25, v);
      }
    }
    // ---- counter arp (bars 32-63)
    if (bar >= 32 && bar < 64) {
      const tones = ch.pad.slice(0, 4).map((m) => m + 12);
      const pat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
      const g = bar < 36 ? (bar - 31) / 5 : 1;
      for (let st = 0; st < 16; st++) {
        const v = g * (st % 4 === 0 ? 1 : 0.72) * (0.85 + 0.15 * s.r()) * 0.3;
        s.add('arp', s.T(bar, st / 4), pluck(mtof(tones[pat[st]]), s.beatSec * 0.2, v, s.seed(), { cut: isB(S) ? 1800 : 1300, envAmt: 2.5, envTau: 0.05, decay: 0.16, q: 1.4, sq: 0.35 }), st % 2 ? 0.35 : -0.35);
      }
    }
  }

  // ---- lead motif (sparingly: bars 24-31 and 64-71)
  const L1 = [[0, 0, 2, 76], [0, 2, 1, 74], [0, 3, 1, 72], [1, 0, 3, 69], [1, 3, 1, 72],
    [2, 0, 1, 67], [2, 1, 1, 72], [2, 2, 1, 76], [2, 3, 1, 79], [3, 0, 3, 74], [3, 3, 1, 71]];
  const L2 = [[0, 0, 1.5, 76], [0, 1.5, 0.5, 79], [0, 2, 1, 76], [0, 3, 1, 74], [1, 0, 2, 72], [1, 2, 1, 69], [1, 3, 1, 72],
    [2, 0, 1, 79], [2, 1, 1, 76], [2, 2, 2, 72], [3, 0, 2, 74], [3, 2, 1, 71], [3, 3, 1, 67]];
  const playLead = (bar0, ph, vel) => {
    for (const [bo, beat, dur, m] of ph) s.add('lead', s.T(bar0 + bo, beat), leadSynth(mtof(m), dur * s.beatSec * 0.92, vel * (0.9 + 0.1 * s.r()), s.seed()), 0.05);
  };
  playLead(24, L1, 0.4); playLead(28, L2, 0.4); playLead(64, L1, 0.38); playLead(68, L2, 0.36);

  // ---- bus processing: filter automation, gating and sidechain ducking
  const padCut = s.auto([[0, 900], [8, 2000], [24, 2400], [40, 3000], [47, 3000], [48, 2400], [72, 2200], [76, 1300], [80, 900]]);
  s.lowpassAuto('pad', padCut, 0.75);
  filtBus(s.bus('pad'), 'hp', 160, 0.7);
  const gateDepth = s.auto([[0, 0], [7.5, 0], [8, 0.75], [39.5, 0.75], [40, 0], [47.5, 0], [48, 0.8], [75.5, 0.8], [76, 0], [80, 0]]);
  const G1 = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0];
  const G2 = [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0];
  {
    // smoothed rhythmic gate
    const step = s.beatSec / 4;
    let gs = 1;
    const k = 1 - Math.exp(-1 / (0.004 * SR));
    s.gain('pad', (t, depth) => {
      const bar = Math.floor(t / s.barSec), st = Math.floor((t - bar * s.barSec) / step) % 16;
      const pat = bar >= 48 && bar < 64 ? G2 : G1;
      const x = (t - bar * s.barSec - st * step) / step;
      const target = pat[st] ? 1 - 0.35 * x : 0.15;
      gs += k * (target - gs);
      return 1 - depth * (1 - gs);
    }, gateDepth);
  }
  const duckDepth = s.auto([[0, 0], [7.9, 0], [8, 1], [39.9, 1], [40, 0], [47.9, 0], [48, 1], [75.9, 1], [76, 0], [80, 0]]);
  const duck = (amt) => (t, depth) => {
    const x = t % s.beatSec;
    const d = x < 0.01 ? x / 0.01 : Math.exp(-(x - 0.01) / 0.11);
    return 1 - amt * depth * d;
  };
  s.gain('bass', duck(0.45), duckDepth);
  s.gain('pad', duck(0.35), duckDepth);
  s.gain('arp', duck(0.25), duckDepth);
  filtBus(s.bus('kick'), 'lp', 5000, 0.7);
  filtBus(s.bus('drums'), 'lp', 11000, 0.7);
  filtBus(s.bus('bass'), 'hp', 30, 0.7);
  filtBus(s.bus('lead'), 'peak', 2500, 1, -2);

  const mix = stereo(s.len);
  const G = { pad: 0.42, bass: 0.48, kick: 0.52, drums: 0.52, arp: 2.0, lead: 0.8 };
  for (const [k, g] of Object.entries(G)) mixInto(mix, s.bus(k), g);
  const lead = s.bus('lead'), arp = s.bus('arp');
  const dl = pingPong(lead.L, lead.R, s.beatSec * 0.75, 0.42, 3200, 300);
  mixInto(mix, dl, 0.16);
  const da = pingPong(arp.L, arp.R, s.beatSec * 0.75, 0.35, 2500, 300);
  mixInto(mix, da, 0.18);
  const send = stereo(s.len);
  mixInto(send, s.bus('pad'), 0.35); mixInto(send, lead, 0.45); mixInto(send, s.bus('drums'), 0.25); mixInto(send, arp, 0.3); mixInto(send, dl, 0.3);
  filtBus(send, 'hp', 280, 0.7); filtBus(send, 'lp', 6500, 0.7);
  mixInto(mix, freeverb(send.L, send.R, { room: 0.85, damp: 0.5, width: 1, predelay: 0.02 }), 0.55);
  filtBus(mix, 'hp', 28, 0.7);
  return { song: s, mix };
}

// ======================================================================= SFX =
function sfxFinish(L, R, { rv = 0, room = 0.5, maxSec = 1.45 } = {}) {
  let n = L.length;
  if (rv > 0) {
    const ext = Math.min(Math.round(maxSec * SR), n + Math.round(0.8 * SR));
    const eL = new Float32Array(ext), eR = new Float32Array(ext);
    eL.set(L.subarray(0, Math.min(n, ext))); eR.set(R.subarray(0, Math.min(n, ext)));
    const w = freeverb(eL, eR, { room, damp: 0.5, width: 1, predelay: 0.008 });
    for (let i = 0; i < ext; i++) { eL[i] += w.L[i] * rv; eR[i] += w.R[i] * rv; }
    L = eL; R = eR; n = ext;
  }
  // trim trailing near-silence, then fade
  const thr = peakOf(L, R) * fromDb(-60);
  let end = n;
  while (end > 1 && Math.abs(L[end - 1]) < thr && Math.abs(R[end - 1]) < thr) end--;
  end = Math.min(n, end + Math.round(0.01 * SR), Math.round(maxSec * SR));
  L = L.slice(0, end); R = R.slice(0, end);
  fadeTail(L, Math.min(0.08, end / SR / 4)); fadeTail(R, Math.min(0.08, end / SR / 4));
  fadeHead(L, 0.0005); fadeHead(R, 0.0005);
  dcBlock(L, 15); dcBlock(R, 15);
  fadeTail(L, 0.003); fadeTail(R, 0.003);
  return { L, R };
}
const mono2 = (m, pan = 0) => { const [gl, gr] = panGains(pan); return { L: m.map((v) => v * gl), R: m.map((v) => v * gr) }; };
const buf = (sec) => new Float32Array(Math.round(sec * SR));
function addAt(dst, src, t, g = 1) { const s0 = Math.round(t * SR); for (let k = 0; k < src.length && s0 + k < dst.length; k++) dst[s0 + k] += src[k] * g; }

const SFX = {
  snap() {
    const rng = mulberry32(11);
    const out = buf(0.25);
    // plastic click + body thump + latch
    const c = noise(Math.round(0.02 * SR), rng);
    for (let i = 0; i < c.length; i++) c[i] *= Math.exp(-i / (0.0018 * SR));
    filt(c, 'hp', 2200, 0.7); filt(c, 'peak', 3400, 2, 8);
    addAt(out, c, 0, 0.9);
    const th = buf(0.08);
    for (let i = 0; i < th.length; i++) th[i] = Math.sin(TAU * 170 * (i / SR) * (1 + 0.6 * Math.exp(-i / (0.01 * SR)))) * Math.exp(-i / (0.018 * SR));
    addAt(out, fadeHead(th, 0.001), 0, 0.7);
    const c2 = noise(Math.round(0.012 * SR), rng);
    for (let i = 0; i < c2.length; i++) c2[i] *= Math.exp(-i / (0.0012 * SR));
    filt(c2, 'bp', 4800, 1.5);
    addAt(out, c2, 0.028, 0.45);
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.12, room: 0.3 });
  },
  solder() {
    const rng = mulberry32(22);
    const n = Math.round(0.95 * SR), out = new Float32Array(n);
    let crack = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.04) * (t < 0.6 ? 1 : Math.exp(-(t - 0.6) / 0.09));
      if (rng() < 0.004) crack = 1 + rng() * 2;
      crack *= 0.995;
      out[i] = (rng() * 2 - 1) * env * (0.35 + 0.65 * crack * (rng() < 0.5 ? 1 : 0.4));
    }
    filt(out, 'bp', 5200, 0.8); filt(out, 'hp', 2500, 0.7); filt(out, 'lp', 9000, 0.7);
    const hum = buf(0.95);
    for (let i = 0; i < hum.length; i++) { const t = i / SR; hum[i] = Math.sin(TAU * 120 * t) * 0.06 * Math.min(1, t / 0.05) * (t < 0.6 ? 1 : Math.exp(-(t - 0.6) / 0.08)); }
    for (let i = 0; i < n; i++) out[i] += hum[i];
    const { L, R } = mono2(out);
    // a little stereo decorrelation
    const R2 = new Float32Array(R.length);
    for (let i = 0; i < R.length; i++) R2[i] = R[Math.max(0, i - 31)];
    return sfxFinish(L, R2, { rv: 0.1, room: 0.3 });
  },
  correct() {
    const out = buf(1.2);
    const note = (f, t, v) => {
      const b = new Float32Array(Math.round(1.0 * SR));
      for (let i = 0; i < b.length; i++) {
        const x = i / SR;
        b[i] = (Math.sin(TAU * f * x) + 0.28 * Math.sin(TAU * 2 * f * x) * Math.exp(-x / 0.15) + 0.06 * Math.sin(TAU * 3.01 * f * x) * Math.exp(-x / 0.08)) * Math.exp(-x / 0.32) * Math.min(1, x / 0.003);
      }
      addAt(out, fadeTail(b, 0.05), t, v);
    };
    note(mtof(81), 0, 0.5);  // A5
    note(mtof(88), 0.11, 0.55); // E6
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.25, room: 0.55, maxSec: 1.2 });
  },
  wrong() {
    const out = buf(0.55);
    const dt0 = 1 / SR;
    let p1 = 0, p2 = 0;
    const svf = new SVF(); svf.set(700, 0.7);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const f = 146.8 * (1 - 0.08 * Math.min(1, t / 0.4));
      const dt1 = f * dt0, dt2 = f * 1.012 * dt0;
      const s1 = 2 * p1 - 1 - blep(p1, dt1), s2 = 2 * p2 - 1 - blep(p2, dt2);
      p1 += dt1; if (p1 >= 1) p1 -= 1; p2 += dt2; if (p2 >= 1) p2 -= 1;
      const env = Math.min(1, t / 0.015) * (t < 0.3 ? 1 : Math.exp(-(t - 0.3) / 0.06));
      const am = 0.8 + 0.2 * Math.sin(TAU * 22 * t);
      out[i] = svf.lp((s1 + s2) * 0.5) * env * am;
    }
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.06, room: 0.3 });
  },
  levelup() {
    const out = buf(1.25);
    const notes = [72, 76, 79, 84, 88, 91];
    notes.forEach((m, k) => {
      const b = pluck(mtof(m), 0.09, 0.8, 100 + k, { cut: 2500, envAmt: 2.5, envTau: 0.05, decay: 0.22, q: 1.0, sq: 0.5 });
      addAt(out, b, k * 0.065, 0.55);
      addAt(out, bell(mtof(m + 12), 0.5, 200 + k, { ratio: 2, index: 0.6, decay: 0.3, len: 0.7 }), k * 0.065, 0.18);
    });
    // final shimmer chord
    for (const m of [84, 88, 91, 96]) addAt(out, bell(mtof(m), 0.5, m, { ratio: 3, index: 0.5, decay: 0.45, idxDecay: 0.1, len: 0.85 }), 0.4, 0.22);
    const { L, R } = mono2(out);
    // gentle width via short delay on R
    const R2 = new Float32Array(R.length);
    for (let i = 0; i < R.length; i++) R2[i] = R[i] * 0.6 + R[Math.max(0, i - 220)] * 0.4;
    return sfxFinish(L, R2, { rv: 0.3, room: 0.6, maxSec: 1.25 });
  },
  alarm() {
    const rng = mulberry32(33);
    const out = buf(0.75);
    const pulse = (t0) => {
      let p = 0;
      const n = Math.round(0.2 * SR), b = new Float32Array(n), svf = new SVF();
      svf.set(1800, 0.9);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = 620 - 140 * (t / 0.2);
        const dt = f / SR;
        const p2 = p + 0.5 >= 1 ? p - 0.5 : p + 0.5;
        const sq = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep(p2, dt);
        p += dt; if (p >= 1) p -= 1;
        const env = Math.min(1, t / 0.01) * (t < 0.15 ? 1 : Math.exp(-(t - 0.15) / 0.02));
        b[i] = (svf.lp(sq) * 0.8 + (rng() * 2 - 1) * 0.12 * (rng() < 0.08 ? 3 : 1)) * env;
      }
      addAt(out, fadeTail(b, 0.01), t0, 1);
    };
    pulse(0); pulse(0.3);
    filt(out, 'lp', 3000, 0.7); filt(out, 'hp', 180, 0.7);
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.08, room: 0.3 });
  },
  click() {
    const rng = mulberry32(44);
    const out = buf(0.06);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      out[i] = (rng() * 2 - 1) * Math.exp(-t / 0.0012) * 0.5 + Math.sin(TAU * 2300 * t) * Math.exp(-t / 0.004);
    }
    filt(out, 'hp', 800, 0.7);
    const { L, R } = mono2(out);
    return sfxFinish(L, R);
  },
  wire() {
    const out = buf(0.22);
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const f = 650 + 900 * (1 - Math.exp(-t / 0.018));
      ph += (TAU * f) / SR;
      out[i] = Math.sin(ph + 0.6 * Math.sin(2 * ph) * Math.exp(-t / 0.02)) * Math.exp(-t / 0.05) * Math.min(1, t / 0.002);
    }
    const rng = mulberry32(55);
    const c = noise(Math.round(0.008 * SR), rng);
    for (let i = 0; i < c.length; i++) c[i] *= Math.exp(-i / (0.0008 * SR));
    filt(c, 'hp', 3000, 0.7);
    addAt(out, c, 0, 0.35);
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.12, room: 0.35 });
  },
  power() {
    const n = Math.round(0.68 * SR), out = new Float32Array(n);
    const svf = new SVF();
    let p = 0, ps = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, x = Math.min(1, t / 0.55);
      const f = 55 * Math.pow(4, x * x * (3 - 2 * x)); // 55 -> 220 Hz, eased
      const dt = f / SR;
      const saw = 2 * p - 1 - blep(p, dt);
      p += dt; if (p >= 1) p -= 1;
      ps += (TAU * f) / SR;
      if ((i & 15) === 0) svf.set(250 + 2800 * x * x, 1.3);
      const env = Math.min(1, t / 0.08) * (t < 0.55 ? 1 : Math.exp(-(t - 0.55) / 0.035));
      out[i] = (svf.lp(saw) * 0.7 + Math.sin(ps) * 0.5) * env;
    }
    const { L, R } = mono2(out);
    return sfxFinish(L, R, { rv: 0.1, room: 0.4, maxSec: 0.75 });
  },
  badge() {
    const rng = mulberry32(66);
    const out = buf(1.3);
    const pent = [84, 86, 88, 91, 93, 96, 98, 100];
    // soft base chime
    addAt(out, bell(mtof(76), 0.45, 7, { ratio: 2, index: 0.5, decay: 0.45, len: 1.1 }), 0, 0.5);
    addAt(out, bell(mtof(83), 0.4, 8, { ratio: 2, index: 0.5, decay: 0.45, len: 1.1 }), 0.03, 0.4);
    let t = 0.02;
    while (t < 0.8) {
      const m = pent[Math.floor(rng() * pent.length)];
      addAt(out, bell(mtof(m), 0.3 + 0.3 * rng(), 1000 + Math.floor(t * 1e4), { ratio: 3.0, index: 0.7, decay: 0.12 + 0.12 * rng(), idxDecay: 0.03, len: 0.5 }), t, 0.35 * (1 - t / 1.0));
      t += 0.025 + 0.06 * rng() + t * 0.05;
    }
    const sh = noise(Math.round(0.9 * SR), rng);
    for (let i = 0; i < sh.length; i++) sh[i] *= Math.exp(-i / (0.25 * SR)) * Math.min(1, i / (0.03 * SR)) * 0.05;
    filt(sh, 'hp', 7000, 0.7);
    addAt(out, sh, 0, 1);
    const { L, R } = mono2(out);
    const R2 = new Float32Array(R.length);
    for (let i = 0; i < R.length; i++) R2[i] = R[Math.max(0, i - 177)];
    return sfxFinish(L, R2, { rv: 0.3, room: 0.55, maxSec: 1.3 });
  },
};

// ------------------------------------------------------------------ output ---
function writeWav(file, L, R, seed = 1) {
  const n = L.length, pcm = new Int16Array(n * 2), rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      const x = (c ? R[i] : L[i]) * 32767 + (rng() - rng()); // TPDF dither
      pcm[i * 2 + c] = clamp(Math.round(x), -32768, 32767);
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.byteLength, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.byteLength, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(pcm.buffer)]));
}
function encodeMp3(wav, mp3) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', String(SR), mp3]);
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
}
// encode, measure the MP3 with ffmpeg and correct the gain once so the
// delivered MP3 (not just the WAV) hits the loudness target
function encodeCalibrated(name, L, R, mp3, target, { short = false, peakCeilDb = -1.2, seed = 1 } = {}) {
  const wav = path.join(OUT_TMP, name + '.wav');
  writeWav(wav, L, R, seed);
  encodeMp3(wav, mp3);
  const m = measure(mp3, short);
  const diff = target == null ? 0 : target - m.I;
  if (Math.abs(diff) > 0.1 && isFinite(diff)) {
    const room = peakCeilDb - m.TP;
    const adj = Math.min(diff, room);
    if (Math.abs(adj) > 0.05) {
      const g = fromDb(adj);
      for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
      writeWav(wav, L, R, seed);
      encodeMp3(wav, mp3);
    }
  }
}
function measure(file, short = false) {
  const af = (short ? 'apad=whole_dur=0.4,' : '') + 'ebur128=peak=true';
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-'], { encoding: 'utf8' });
  const sum = r.stderr.split('Summary:').pop();
  const I = parseFloat((sum.match(/I:\s+(-?[\d.]+|-inf) LUFS/) || [])[1]);
  const TP = parseFloat((sum.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/) || [])[1]);
  const d = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return { I, TP, dur: parseFloat(d.stdout), size: fs.statSync(file).size };
}
function decodeF32(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  const n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return { L, R };
}
function seamStats(L, R) {
  const n = L.length, w = Math.round(0.05 * SR);
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += L[i] * L[i] + R[i] * R[i]; return Math.sqrt(s / (2 * (b - a))); };
  const jump = Math.max(Math.abs(L[0] - L[n - 1]), Math.abs(R[0] - R[n - 1]));
  // typical sample-to-sample step in the 50 ms around the seam
  let acc = 0, mx = 0;
  for (let i = n - w + 1; i < n; i++) { const d = Math.max(Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1])); acc += d; mx = Math.max(mx, d); }
  for (let i = 1; i < w; i++) { const d = Math.max(Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1])); acc += d; mx = Math.max(mx, d); }
  return { headDb: dB(rms(0, w)), tailDb: dB(rms(n - w, n)), jump, meanStep: acc / (2 * w - 2), maxStep: mx };
}

// -------------------------------------------------------------------- main ---
const TRACKS = [
  { id: 'focus', title: '專注模式', subtitle: 'Lo-fi · 78 BPM', bpm: 78, fn: songFocus },
  { id: 'debug', title: '深度除錯', subtitle: 'Ambient · 76 BPM', bpm: 76, fn: songDebug },
  { id: 'sprint', title: '衝刺建構', subtitle: 'Synthwave · 100 BPM', bpm: 100, fn: songSprint },
];

function main() {
  fs.mkdirSync(OUT_TMP, { recursive: true });
  fs.mkdirSync(SFX_DIR, { recursive: true });
  const report = [];
  const t0 = Date.now();

  for (const tr of TRACKS) {
    if (!want(tr.id)) continue;
    const ts = Date.now();
    const { song, mix } = tr.fn();
    const busRms = song.rmsReport();
    const { L, R, limiterHits } = master(song, mix, { target: -18, ceil: -1.5 });
    const mp3 = path.join(AUDIO_DIR, tr.id + '.mp3');
    encodeCalibrated(tr.id, L, R, mp3, -18, { seed: tr.bpm });
    const seam = seamStats(L, R);
    console.log(`[${tr.id}] ${song.loopSec.toFixed(2)} s, rendered in ${((Date.now() - ts) / 1000).toFixed(1)} s, limiter samples=${limiterHits}`);
    for (const [k, v] of Object.entries(busRms)) console.log(`   ${k.padEnd(6)} ${v}`);
    console.log(`   internal LUFS=${lufs(L, R).toFixed(2)} peak=${dB(peakOf(L, R)).toFixed(2)} dBFS`);
    console.log(`   WAV seam: head ${seam.headDb.toFixed(1)} dB / tail ${seam.tailDb.toFixed(1)} dB, jump ${seam.jump.toFixed(5)} (mean step ${seam.meanStep.toFixed(5)}, max step ${seam.maxStep.toFixed(5)})`);
    report.push({ kind: 'track', id: tr.id, file: mp3, loopSec: song.loopSec, seam });
  }
  if (want('focus') || want('debug') || want('sprint') || !ONLY) {
    const tj = TRACKS.map((t) => {
      const secs = (() => { const s = new Song(t.id, { bpm: t.bpm, bars: t.id === 'sprint' ? 80 : 64, seed: 1, warm: 0 }); return Math.round(s.loopSec * 100) / 100; })();
      return { id: t.id, title: t.title, subtitle: t.subtitle, file: `audio/${t.id}.mp3`, bpm: t.bpm, duration: secs, loop: true };
    });
    fs.writeFileSync(path.join(AUDIO_DIR, 'tracks.json'), JSON.stringify(tj, null, 2) + '\n');
  }

  if (want('sfx')) {
    for (const [name, fn] of Object.entries(SFX)) {
      let { L, R } = fn();
      const pk = peakOf(L, R);
      const gLoud = fromDb(-16 - lufs(L, R));
      const gPeak = fromDb(-1.6) / pk;
      const g = Math.min(gLoud, gPeak);
      for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
      const mp3 = path.join(SFX_DIR, name + '.mp3');
      encodeCalibrated('sfx_' + name, L, R, mp3, g === gPeak ? null : -16, { short: true, seed: name.length });
      console.log(`[sfx/${name}] ${(L.length / SR).toFixed(3)} s  LUFS=${lufs(L, R).toFixed(1)} peak=${dB(peakOf(L, R)).toFixed(1)}${g === gPeak ? ' (peak-limited)' : ''}`);
      report.push({ kind: 'sfx', id: name, file: mp3 });
    }
  }

  if (VERIFY) {
    console.log('\n=== verification (ffmpeg ebur128 on the MP3 files) ===');
    for (const r of report) {
      const m = measure(r.file, r.kind === 'sfx');
      let extra = '';
      if (r.kind === 'track') {
        const d = decodeF32(r.file);
        const st = seamStats(d.L, d.R);
        extra = ` | decoded ${d.L.length} smp (expected ${Math.round(r.loopSec * SR)}) seam jump ${st.jump.toFixed(4)} vs mean step ${st.meanStep.toFixed(4)} max ${st.maxStep.toFixed(4)}; head/tail RMS ${st.headDb.toFixed(1)}/${st.tailDb.toFixed(1)} dB`;
      }
      console.log(`${path.relative(ROOT, r.file).padEnd(28)} ${m.dur.toFixed(3).padStart(8)} s ${(m.size / 1024).toFixed(0).padStart(5)} KB  I=${m.I.toFixed(1)} LUFS  TP=${m.TP.toFixed(1)} dBTP${extra}`);
    }
  }
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
export { kick, snare, hat, rim, clap, epiano, subBass, pluck, bell, leadSynth, synthBass, sawPad, lufs, SR };
