import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MOTORS, MOTOR_SHAFT, type MotorId } from '../../sim/flight';
import { simVisual } from '../../sim/engine';
import { MCU } from '../../sim/board';
import { splitEp, type Comp, type Wire } from '../../sim/types';
import { Box, Cyl, MAT, useLabelTexture } from '../../three/parts/primitives';
import { SF_MOTOR_MM, sx, sz } from '../../data/boards/stampfly';
import { PROP_Y } from '../../three/boards/stampflyVisual';
import { useBench } from './benchStore';

export const PROP_COLOR = { cw: '#e2e8f0', ccw: '#fb923c' } as const;
const SHAFT_TO_MOTOR = Object.fromEntries(MOTORS.map((m) => [MOTOR_SHAFT[m], m])) as Record<string, MotorId>;

/** 這條線是不是「把螺旋槳套上馬達軸」：這種連線不畫成杜邦線 */
export function isPropMount(w: Wire, comps: Comp[]) {
  const ends = [splitEp(w.a), splitEp(w.b)];
  const prop = ends.find(([o, p]) => p === 'HUB' && comps.find((c) => c.id === o)?.type === 'prop');
  const shaft = ends.find(([o, p]) => o === MCU && SHAFT_TO_MOTOR[p]);
  return !!prop && !!shaft;
}

/** 每顆馬達上裝的槳（只看直接的連線） */
export function mountedProps(comps: Comp[], wires: Wire[]): Partial<Record<MotorId, Comp & { wire: string }>> {
  const out: Partial<Record<MotorId, Comp & { wire: string }>> = {};
  for (const w of wires) {
    if (!isPropMount(w, comps)) continue;
    const ends = [splitEp(w.a), splitEp(w.b)];
    const shaft = ends.find(([o]) => o === MCU)![1];
    const pid = ends.find(([o]) => o !== MCU)![0];
    const c = comps.find((x) => x.id === pid);
    if (c) out[SHAFT_TO_MOTOR[shaft]] = { ...c, wire: w.id };
  }
  return out;
}

/** 兩葉槳：葉片依轉向扭一個角度（CW 槳和 CCW 槳互為鏡像） */
export function PropMesh({ dir, opacity = 1 }: { dir: 'cw' | 'ccw'; opacity?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: PROP_COLOR[dir], roughness: 0.45, transparent: opacity < 1, opacity }), [dir, opacity]);
  const twist = dir === 'cw' ? 0.35 : -0.35;
  return (
    <group>
      <Cyl r={0.13} h={0.16} mat={mat} />
      {[0, Math.PI].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0.78, 0, 0]} rotation={[twist, 0, 0]} material={mat} castShadow scale={[1.35, 0.025, 0.3]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 套在馬達軸上的螺旋槳：依馬達轉速旋轉，轉快時變成半透明圓盤 */
function SpinningProp({ m, dir, wire }: { m: MotorId; dir: 'cw' | 'ccw'; wire: string }) {
  const g = useRef<THREE.Group>(null!);
  const disc = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    const w = simVisual.drone?.w[m] ?? 0;
    // 從上往下看：CW＝順時針＝繞 +y 負方向
    g.current.rotation.y += (dir === 'cw' ? -1 : 1) * w * 40 * dt;
    const blur = THREE.MathUtils.clamp((w - 0.15) * 2.5, 0, 1);
    (disc.current.material as THREE.MeshBasicMaterial).opacity = blur * 0.35;
    g.current.visible = blur < 0.95;
  });
  const [mx, my] = SF_MOTOR_MM[m];
  return (
    <group
      position={[sx(mx), PROP_Y, sz(my)]}
      onClick={(e) => {
        e.stopPropagation();
        const st = useBench.getState();
        if (!st.running) st.removeWire(wire);
      }}
      onPointerOver={() => { document.body.style.cursor = useBench.getState().running ? '' : 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <group ref={g}><PropMesh dir={dir} /></group>
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.15, 1.5, 40]} />
        <meshBasicMaterial color={PROP_COLOR[dir]} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** 放進飛機模型裡（跟著飛機移動）的四支槳 */
export function DroneProps() {
  const comps = useBench((s) => s.comps);
  const wires = useBench((s) => s.wires);
  const mounted = mountedProps(comps, wires);
  return (
    <>
      {MOTORS.map((m) => {
        const c = mounted[m];
        return c ? <SpinningProp key={m} m={m} dir={c.props.dir ?? 'cw'} wire={c.wire} /> : null;
      })}
    </>
  );
}

/** 工作台上的槳卡：沒裝時槳躺在卡上，裝上後只剩淡淡的輪廓 */
export function PropBody({ c }: { c: Comp }) {
  const wires = useBench((s) => s.wires);
  const comps = useBench((s) => s.comps);
  const used = wires.some((w) => (w.a === `${c.id}:HUB` || w.b === `${c.id}:HUB`) && isPropMount(w, comps));
  const dir = c.props.dir ?? 'cw';
  const tag = useLabelTexture([dir.toUpperCase()], 256, 128, dir === 'cw' ? '#0f172a' : '#431407', PROP_COLOR[dir]);
  return (
    <group position={[0, 0, -0.2]}>
      <group position={[0, 0.12, 0]} rotation={[0, 0.3, 0]} scale={0.62}>
        <PropMesh dir={dir} opacity={used ? 0.18 : 1} />
      </group>
      <mesh position={[0.62, 0.02, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={tag} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** 1S 鋰電池：銀色軟包＋紅黑線 */
export function LipoBody() {
  const tex = useLabelTexture(['1S 3.7V HV', '300mAh'], 512, 256, '#1e293b', '#e5e7eb');
  const pouch = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4d8de', metalness: 0.6, roughness: 0.35 }), []);
  return (
    <group position={[0, 0, -0.2]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.9, 0.4, 1.0]} />
        <primitive object={pouch} attach="material-0" />
        <primitive object={pouch} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.4} />
        <primitive object={pouch} attach="material-3" />
        <primitive object={pouch} attach="material-4" />
        <primitive object={pouch} attach="material-5" />
      </mesh>
      <Box size={[0.07, 0.06, 0.45]} pos={[-0.5, 0.05, 0.62]} mat={new THREE.MeshStandardMaterial({ color: '#e0362c' })} />
      <Box size={[0.07, 0.06, 0.45]} pos={[0.5, 0.05, 0.62]} mat={MAT.black} />
    </group>
  );
}
