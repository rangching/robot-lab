// 蜂鳴器聲音：用 Web Audio 產生小音量方波
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;

export function buzzerTone(freq: number) {
  try {
    if (freq <= 0) {
      if (gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      return;
    }
    if (!ctx) ctx = new AudioContext();
    if (!osc) {
      osc = ctx.createOscillator();
      osc.type = 'square';
      gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = 3500;
      osc.connect(lp).connect(gain).connect(ctx.destination);
      osc.start();
    }
    void ctx.resume();
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain!.gain.setTargetAtTime(0.045, ctx.currentTime, 0.005);
  } catch {
    /* 瀏覽器不支援時安靜失敗 */
  }
}
