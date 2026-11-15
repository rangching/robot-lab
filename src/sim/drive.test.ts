import { describe, expect, it } from 'vitest';
import { BOT, COUNTS_PER_CM, COUNTS_PER_REV, DriveSim, LAYOUTS, deg, nearest } from './drive';
import { linePosition } from './programsThreepi';

const run = (s: DriveSim, ms: number, l: number, r: number) => {
  s.setSpeeds(l, r);
  s.step(ms / 1000);
};

describe('3pi+ 差速驅動', () => {
  it('編碼器換算：Standard 版輪子一圈約 358 counts、每公分約 35.6', () => {
    expect(COUNTS_PER_REV).toBeCloseTo(358.3, 0);
    expect(COUNTS_PER_CM).toBeCloseTo(35.6, 1);
  });

  it('兩輪同速往前：前進距離和編碼器一致，右輪略弱所以會慢慢偏左', () => {
    const s = new DriveSim('open');
    run(s, 1000, 2000, 2000);
    run(s, 400, 0, 0);
    const adv = s.stats.maxAdvance;
    // 速度 2000 ≈ 0.5 m/s，扣掉加速時間大約 47 cm
    expect(adv).toBeGreaterThan(40);
    expect(adv).toBeLessThan(52);
    const [l, r] = s.counts();
    expect((l + r) / 2 / COUNTS_PER_CM).toBeCloseTo(s.stats.dist, -0.5);
    expect(l).toBeGreaterThan(r);
    expect(s.th).toBeGreaterThan(-0.2);
    expect(s.th).toBeLessThan(0);
  });

  it('負速度倒車；set_speeds 夾在 ±6000', () => {
    const s = new DriveSim({ ...LAYOUTS.open, start: { x: 0, y: 0, th: 0 } });
    s.setSpeeds(9999, -9999);
    expect([s.cmdL, s.cmdR]).toEqual([6000, -6000]);
    run(s, 300, 0, 0);
    run(s, 500, -1500, -1500);
    run(s, 300, 0, 0);
    expect(s.stats.minAdvance).toBeLessThan(-10);
    expect(s.counts()[0]).toBeLessThan(0);
  });

  it('原地左轉：車子中心幾乎不動，角度和編碼器算出來的一樣', () => {
    const s = new DriveSim('open');
    const [x0, y0] = [s.x, s.y];
    run(s, 300, -1000, 1000);
    run(s, 300, 0, 0);
    const [l, r] = s.counts();
    const byEnc = deg((r - l) / 2 / COUNTS_PER_CM / (BOT.trackW * 50));
    expect(s.stats.turn).toBeGreaterThan(60);
    expect(byEnc).toBeCloseTo(s.stats.turn, 0);
    expect(Math.hypot(s.x - x0, s.y - y0)).toBeLessThan(0.01);
  });

  it('正面撞牆：兩個碰撞開關都被壓下，車子被擋住', () => {
    const s = new DriveSim('open');
    run(s, 3000, 3000, 3000);
    expect(s.x).toBeCloseTo(LAYOUTS.open.hw - BOT.radius, 3);
    expect(s.bumpL && s.bumpR).toBe(true);
    expect(s.stats.bumpsL).toBe(1);
  });

  it('只撞到左前方：只有左邊的碰撞開關', () => {
    // 機頭朝 +x、牆在上方（+y）：車頭往左前方斜斜撞上去
    const s = new DriveSim({ ...LAYOUTS.open, start: { x: 0, y: 0.25, th: 0.6 } });
    run(s, 1000, 1500, 1500);
    expect(s.stats.bumpsL).toBeGreaterThan(0);
    expect(s.stats.bumpsR).toBe(0);
  });

  it('側面擦到牆：碰撞開關感覺不到', () => {
    const s = new DriveSim({ ...LAYOUTS.open, start: { x: 0, y: LAYOUTS.open.hd - BOT.radius - 0.002, th: 0 } });
    // 往右邊（−y）轉一點點又轉回來，屁股和側面擦牆
    run(s, 400, 1500, 1700);
    expect(s.stats.bumpsL + s.stats.bumpsR).toBe(0);
    expect(s.stats.sideHits).toBeGreaterThan(0);
  });

  it('循線感測器：起點在黑線上時中間那顆最黑；校正後是 0–1000', () => {
    const s = new DriveSim('oval');
    expect(nearest(LAYOUTS.oval.path!, s.x, s.y).d).toBeLessThan(0.002);
    expect(s.readCalibrated()).toEqual([0, 0, 0, 0, 0]); // 還沒校正
    expect(s.calibrated).toBe(false);
    for (let i = 0; i < 120; i++) { s.setSpeeds(i < 30 || i >= 90 ? 1000 : -1000, i < 30 || i >= 90 ? -1000 : 1000); s.calibrate(); s.step(0.005); }
    expect(s.calibrated).toBe(true);
    s.setSpeeds(0, 0);
    s.step(0.3);
    const line = s.readCalibrated();
    expect(Math.max(...line)).toBeGreaterThan(600);
    expect(line.every((v) => v >= 0 && v <= 1000)).toBe(true);
  });

  it('官方算法的線位置：正中間 2000、偏右變大、看不到線照上次方向', () => {
    expect(linePosition([0, 0, 1000, 0, 0], 0)).toBe(2000);
    expect(linePosition([0, 0, 800, 800, 0], 0)).toBe(2500);
    expect(linePosition([0, 0, 0, 0, 900], 300)).toBe(4000);
    expect(linePosition([100, 0, 0, 0, 0], -50)).toBe(0);
  });
});

/** 照任務程式的寫法：校正後用 PD 循線 */
function follow(layout: 'oval' | 'wavy', spd: number, kp: number, kd: number, ms = 12000) {
  const s = new DriveSim(layout);
  for (const [n, l, r] of [[40, 1000, -1000], [80, -1000, 1000], [40, 1000, -1000]] as const) {
    s.setSpeeds(l, r);
    for (let i = 0; i < n; i++) { s.calibrate(); s.step(0.005); }
  }
  s.setSpeeds(0, 0);
  s.step(0.3);
  s.startLap();
  let last = 0;
  for (let t = 0; t < ms; t += 4) {
    const l = linePosition(s.readCalibrated(), last);
    const p = l - 2000;
    const pid = Math.floor((p * kp + (p - last) * kd) / 10);
    last = p;
    s.setSpeeds(Math.max(0, Math.min(spd, spd + pid)), Math.max(0, Math.min(spd, spd - pid)));
    s.step(0.004);
  }
  return s.stats;
}

describe('3pi+ 循線', () => {
  it('橢圓賽道：預設 P 控制（速度 1500、kp 10）跑得完一圈，提速到 3000 也不脫軌', () => {
    const a = follow('oval', 1500, 10, 0);
    expect(a.laps).toBeGreaterThanOrEqual(1);
    // 賽道長 2.26 m、平均約 0.3 m/s：一圈 6～9 秒（不含校正時間）
    expect(a.lapMs).toBeGreaterThan(6000);
    expect(a.lapMs).toBeLessThan(9000);
    expect(a.derails).toBe(0);
    const b = follow('oval', 3000, 10, 0);
    expect(b.laps).toBeGreaterThanOrEqual(1);
    expect(b.derails).toBe(0);
  });

  it('彎道賽道、速度 5000：只有 P 會甩出去，加上 D 就能穩穩跑兩圈', () => {
    const p = follow('wavy', 5000, 10, 0);
    expect(p.derails).toBeGreaterThan(0);
    const pd = follow('wavy', 5000, 10, 300);
    expect(pd.derails).toBe(0);
    expect(pd.laps).toBeGreaterThanOrEqual(2);
  });
});
