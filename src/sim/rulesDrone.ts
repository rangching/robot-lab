/**
 * M5Stamp Fly 的上電前檢查：電池極性、螺旋槳轉向、槳裝在哪裡。
 * 由 rules.ts 的 checkCircuit() 在板子是 stampfly 時呼叫。
 */
import { MCU, gndEps } from './board';
import type { Nets } from './netlist';
import { droneHardware } from './drone';
import { MOTORS, MOTOR_DIR, MOTOR_GPIO, MOTOR_NAME, MOTOR_SHAFT } from './flight';
import { ep, splitEp, type Comp, type Issue } from './types';

const DIR_NAME = { cw: '順時針（CW）', ccw: '逆時針（CCW）' } as const;

export function checksDrone(nets: Nets, comps: Comp[], outputs: string[] | null, label: (c: Comp) => string): Issue[] {
  const issues: Issue[] = [];
  const G = gndEps();
  const toGnd = (e: string) => G.some((g) => nets.same(e, g));
  const bat = ep(MCU, 'BAT');

  for (const c of comps) {
    if (c.type === 'lipo') {
      const P = ep(c.id, 'P');
      const N = ep(c.id, 'N');
      if (nets.same(P, N) || (toGnd(P) && nets.same(N, bat))) {
        issues.push({
          level: 'error',
          code: nets.same(P, N) ? 'bat-short' : 'bat-reversed',
          text: nets.same(P, N)
            ? `${label(c)} 的正負極接在一起，等於把電池短路！鋰電池短路會瞬間放出好幾安培的電流，發燙、鼓脹甚至起火。`
            : `${label(c)} 接反了！紅線（＋）要接 BAT+、黑線（−）接 BAT−。接反會把反向電壓灌進電源電路，馬達驅動和 StampS3 都可能燒壞。`,
          endpoints: [P, N, bat, ...G],
        });
        continue;
      }
      if (toGnd(P)) issues.push({ level: 'error', code: 'bat-short', text: `${label(c)} 的＋接到了 GND，電池會直接短路。`, endpoints: [P, ...G] });
      // ＋接到 BAT 以外的地方（5V、GPIO）
      const others = nets.members(nets.netOf(P)).filter((m) => {
        const [o, p] = splitEp(m);
        return o === MCU && p !== 'BAT' && !G.includes(m);
      });
      if (others.length) {
        issues.push({ level: 'error', code: 'bat-wrong', text: `${label(c)} 的＋只能接 BAT+。接到 ${others.map((m) => splitEp(m)[1]).join('、')} 會讓 4 V 的電池電壓灌進不該去的地方。`, endpoints: [P, ...others] });
      }
    }
    if (c.type === 'prop') {
      const hub = ep(c.id, 'HUB');
      const mem = nets.members(nets.netOf(hub)).filter((m) => m !== hub);
      const onShaft = MOTORS.some((m) => mem.includes(ep(MCU, MOTOR_SHAFT[m])));
      if (mem.length && !onShaft) {
        issues.push({ level: 'warn', code: 'prop-where', text: `${label(c)} 的槳轂只能套在馬達軸上（四個角落的馬達頂端），接到其他地方沒有意義。`, endpoints: [hub] });
      }
      if (mem.some((m) => splitEp(m)[0] !== MCU)) {
        issues.push({ level: 'warn', code: 'prop-where', text: `${label(c)} 的槳轂接到了其他元件，請直接接到馬達軸。`, endpoints: [hub] });
      }
    }
  }

  const hw = droneHardware(comps, nets);
  for (const m of MOTORS) {
    const shaft = ep(MCU, MOTOR_SHAFT[m]);
    if (hw.propIds[m].length > 1) {
      issues.push({ level: 'error', code: 'prop-double', text: `${MOTOR_NAME[m]} 馬達上裝了 ${hw.propIds[m].length} 支槳，一顆馬達只能裝一支。`, endpoints: [shaft, ...hw.propIds[m].map((id) => ep(id, 'HUB'))] });
    } else if (hw.props[m] === 'wrong') {
      const want = MOTOR_DIR[m];
      issues.push({
        level: 'error',
        code: 'prop-dir',
        text: `${MOTOR_NAME[m]} 馬達是${DIR_NAME[want]}轉，要裝 ${want.toUpperCase()} 槳，你裝的是 ${want === 'cw' ? 'CCW' : 'CW'} 槳。槳裝反會把空氣往上吹，一推油門就翻過去。`,
        endpoints: [shaft, ...hw.propIds[m].map((id) => ep(id, 'HUB'))],
      });
    }
  }

  // 程式會驅動馬達，但電池沒接：USB 的電流推不動馬達
  const drivesMotors = outputs === null || MOTORS.some((m) => outputs.includes(MOTOR_GPIO[m]));
  const flight = outputs !== null && MOTORS.every((m) => outputs.includes(MOTOR_GPIO[m]));
  if (drivesMotors && flight && !hw.battery && !issues.some((i) => i.code.startsWith('bat-'))) {
    issues.push({ level: 'warn', code: 'no-battery', text: '還沒接電池。插著 USB 程式照樣會跑，但 USB 的電流只夠 StampS3 用，馬達轉不起來。', endpoints: [bat] });
  }
  const mounted = MOTORS.filter((m) => hw.props[m]);
  if (mounted.length > 0 && mounted.length < 4) {
    issues.push({ level: 'warn', code: 'prop-missing', text: `只裝了 ${mounted.length} 支槳。四軸少一支槳就沒辦法平衡，飛之前四支都要裝好。`, endpoints: MOTORS.filter((m) => !hw.props[m]).map((m) => ep(MCU, MOTOR_SHAFT[m])) });
  }
  return issues;
}
