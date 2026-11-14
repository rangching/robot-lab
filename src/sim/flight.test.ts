import { describe, expect, it } from 'vitest';
import { FlightSim, MOTORS, NO_STICK, deg, type Hardware, type MotorId, type Stick } from './flight';

const OK: Hardware = { props: { FL: 'ok', FR: 'ok', RL: 'ok', RR: 'ok' }, battery: true };
const zero: Record<MotorId, number> = { FL: 0, FR: 0, RL: 0, RR: 0 };

function run(f: FlightSim, secs: number, stick: Stick = NO_STICK, direct = zero) {
  for (let t = 0; t < secs; t += 0.016) f.step(0.016, direct, stick);
}

describe('飛行物理', () => {
  it('沒解鎖時馬達不轉、停在地上', () => {
    const f = new FlightSim(OK);
    f.setup({ mode: 'alt' });
    run(f, 2);
    expect(f.s.z).toBe(0);
    MOTORS.forEach((m) => expect(f.s.w[m]).toBe(0));
  });

  it('油門沒歸零、沒接電池、機身傾斜都會拒絕解鎖', () => {
    const f = new FlightSim(OK);
    f.setup({ mode: 'stab' });
    expect(f.arm({ ...NO_STICK, thr: 0.4 })).toMatch(/油門/);
    expect(new FlightSim({ ...OK, battery: false }).arm(NO_STICK)).toMatch(/電池/);
    const g = new FlightSim(OK);
    g.setup({ mode: 'stab' });
    run(g, 1, { ...NO_STICK, roll: 1 });
    expect(g.arm(NO_STICK)).toMatch(/水平/);
    expect(f.arm(NO_STICK)).toBeNull();
    expect(f.armed).toBe(true);
  });

  it('定高：只有 P＋D 時停在目標下方；加上 I 之後收斂到目標', () => {
    const pd = new FlightSim(OK);
    pd.setup({ mode: 'alt', kp: 0.5, ki: 0, kd: 0.25, altRef: 0.5 });
    expect(pd.arm(NO_STICK)).toBeNull();
    run(pd, 10);
    expect(pd.s.z).toBeGreaterThan(0.15);
    expect(pd.s.z).toBeLessThan(0.45);

    const pid = new FlightSim(OK);
    pid.setup({ mode: 'alt', kp: 0.5, ki: 0.6, kd: 0.25, altRef: 0.5 });
    pid.arm(NO_STICK);
    run(pid, 14);
    expect(Math.abs(pid.s.z - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(deg(pid.s.roll))).toBeLessThan(3);
    expect(pid.flipped).toBe(false);
  });

  it('自穩模式：推油門會離地，搖桿往右會往右傾', () => {
    const f = new FlightSim(OK);
    f.setup({ mode: 'stab' });
    f.arm(NO_STICK);
    run(f, 1.5, { ...NO_STICK, thr: 0.8 });
    expect(f.s.z).toBeGreaterThan(0.05);
    run(f, 0.6, { ...NO_STICK, thr: 0.75, roll: 0.6 });
    expect(deg(f.s.roll)).toBeGreaterThan(8);
    expect(f.flipped).toBe(false);
  });

  it('有一顆槳裝反：一起飛就翻覆，馬達被切斷', () => {
    const f = new FlightSim({ ...OK, props: { ...OK.props, FL: 'wrong' } });
    f.setup({ mode: 'stab' });
    f.arm(NO_STICK);
    run(f, 3, { ...NO_STICK, thr: 0.8 });
    expect(f.flipped).toBe(true);
    expect(f.armed).toBe(false);
  });

  it('直接寫馬達（測試程式）：沒裝槳也會轉，但不會飛', () => {
    const f = new FlightSim({ props: { FL: null, FR: null, RL: null, RR: null }, battery: true });
    run(f, 0.5, NO_STICK, { ...zero, FR: 0.3 });
    expect(f.s.w.FR).toBeGreaterThan(0.2);
    expect(f.s.w.FL).toBe(0);
    expect(f.s.z).toBe(0);
  });

  it('上鎖時在空中會先自動降落', () => {
    const f = new FlightSim(OK);
    f.setup({ mode: 'alt', kp: 0.5, ki: 0.6, kd: 0.25, altRef: 0.4 });
    f.arm(NO_STICK);
    run(f, 6);
    expect(f.s.z).toBeGreaterThan(0.2);
    f.disarm();
    expect(f.armed).toBe(true);
    run(f, 6);
    expect(f.s.z).toBeLessThan(0.03);
    expect(f.armed).toBe(false);
  });
});
