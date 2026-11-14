import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SF_BODY, SF_C, SF_MOTOR_MM, SF_PCB_T, SF_BENCH_LIFT, SF_SHAFT_TOP, SF_W, SF_D } from '../../data/boards/stampfly';
import { simVisual } from '../../sim/engine';
import { useDrone } from '../../sim/drone';
import { PHYS } from '../../sim/flight';
import { Box, Cyl, MAT, SmdChip, SmdLed, useLabelTexture } from '../parts/primitives';
import { ARM_W, HOLE_R, RING_R, makeStampflyBottom, makeStampflyTop } from './stampflyTexture';
import type { BoardVisual, Lights } from './visualTypes';

/** 畫面上 1 公尺的高度對應幾公分（綁繩 0.6 m → 3.6 cm），避免飛機飛出鏡頭 */
export const ALT_SCALE = 6;

const cm = (mm: number) => mm / 10;

/** X 形機身：多個擠出形狀疊成外框，上下各蓋一片帶貼圖的平面（貼圖外圍透明） */
function FramePcb({ top, bottom, edge }: { top: THREE.Texture; bottom: THREE.Texture; edge: THREE.Material }) {
  const geos = useMemo(() => {
    const out: THREE.ExtrudeGeometry[] = [];
    const ext = { depth: SF_PCB_T, bevelEnabled: false, curveSegments: 28 };
    // 形狀座標 (u, v)：u＝x、v＝機頭方向（＝ −z）
    const u = (mm: number) => cm(mm) - SF_W / 2;
    const v = (mm: number) => cm(mm) - SF_D / 2;
    const b = SF_BODY;
    const body = new THREE.Shape();
    body.moveTo(u(b.x0), v(b.y0)).lineTo(u(b.x1), v(b.y0)).lineTo(u(b.x1), v(b.y1)).lineTo(u(b.x0), v(b.y1)).closePath();
    out.push(new THREE.ExtrudeGeometry(body, ext));
    for (const [mx, my] of Object.values(SF_MOTOR_MM)) {
      const dx = mx - SF_C;
      const dy = my - SF_C;
      const len = Math.hypot(dx, dy);
      const nx = (-dy / len) * (ARM_W / 2);
      const ny = (dx / len) * (ARM_W / 2);
      const arm = new THREE.Shape();
      arm.moveTo(u(SF_C + nx), v(SF_C + ny)).lineTo(u(mx + nx - (dx / len) * RING_R * 0.8), v(my + ny - (dy / len) * RING_R * 0.8)).lineTo(u(mx - nx - (dx / len) * RING_R * 0.8), v(my - ny - (dy / len) * RING_R * 0.8)).lineTo(u(SF_C - nx), v(SF_C - ny)).closePath();
      out.push(new THREE.ExtrudeGeometry(arm, ext));
      const ring = new THREE.Shape();
      ring.absarc(u(mx), v(my), cm(RING_R), 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(u(mx), v(my), cm(HOLE_R), 0, Math.PI * 2, true);
      ring.holes.push(hole);
      out.push(new THREE.ExtrudeGeometry(ring, ext));
    }
    return out;
  }, []);
  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -SF_PCB_T, 0]}>
        {geos.map((g, i) => <mesh key={i} geometry={g} material={edge} castShadow receiveShadow />)}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[SF_W, SF_D]} />
        <meshStandardMaterial map={top} alphaTest={0.5} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -SF_PCB_T - 0.003, 0]}>
        <planeGeometry args={[SF_W, SF_D]} />
        <meshStandardMaterial map={bottom} alphaTest={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

const SHELL = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.55 });
const CAN = new THREE.MeshStandardMaterial({ color: '#c3c8cf', metalness: 0.9, roughness: 0.3 });
const BRASS = new THREE.MeshStandardMaterial({ color: '#c9a54a', metalness: 0.9, roughness: 0.3 });
const RED = new THREE.MeshStandardMaterial({ color: '#d83b3b', roughness: 0.5 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#3a2f5c', metalness: 0.3, roughness: 0.1 });

/** M5StampS3：插在排母上的小模組，側邊有 USB-C */
function StampS3() {
  // 空白行讓字小一點，才不會超出模組頂面
  const tex = useLabelTexture(['', 'M5Stamp S3', 'ESP32-S3', '', ''], 1024, 768, '#e8e9ec', '#2b2f36');
  return (
    <group>
      <Box size={[2.0, 0.14, 0.2]} pos={[0, 0.07, -0.75]} mat={MAT.black} />
      <Box size={[2.0, 0.14, 0.2]} pos={[0, 0.07, 0.75]} mat={MAT.black} />
      <mesh position={[0, 0.14 + 0.2, 0]} castShadow>
        <boxGeometry args={[2.4, 0.4, 1.8]} />
        <primitive object={SHELL} attach="material-0" />
        <primitive object={SHELL} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.55} />
        <primitive object={SHELL} attach="material-3" />
        <primitive object={SHELL} attach="material-4" />
        <primitive object={SHELL} attach="material-5" />
      </mesh>
      {/* USB-C 朝 +x */}
      <Box size={[0.3, 0.3, 0.9]} pos={[1.13, 0.34, 0]} mat={MAT.steel} />
      <Box size={[0.02, 0.16, 0.66]} pos={[1.285, 0.34, 0]} mat={MAT.hole} />
      {/* 側邊的按鈕 */}
      <Box size={[0.4, 0.12, 0.06]} pos={[-0.5, 0.34, -0.93]} mat={MAT.white} />
    </group>
  );
}

/** 716 空心杯馬達：穿過 PCB 的圓孔，上方露出黃銅端蓋與軸心 */
function CorelessMotor() {
  return (
    <group>
      <Cyl r={0.35} h={1.45} pos={[0, 0.175, 0]} mat={CAN} />
      <Cyl r={0.42} h={0.28} pos={[0, 0.05, 0]} mat={MAT.black} />
      <Cyl r={0.24} h={0.05} pos={[0, 0.92, 0]} mat={BRASS} />
      <Cyl r={0.04} h={0.36} pos={[0, 1.08, 0]} mat={MAT.steel} />
      <Box size={[0.05, 0.05, 0.4]} pos={[0.12, -0.5, 0.25]} mat={RED} />
      <Box size={[0.05, 0.05, 0.4]} pos={[-0.12, -0.5, 0.25]} mat={new THREE.MeshStandardMaterial({ color: '#2f6fd6' })} />
    </group>
  );
}

/** Grove（HY2.0-4P）母座：線從機尾方向（+z）插入 */
function Grove({ color }: { color: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), [color]);
  return (
    <group>
      <Box size={[0.86, 0.5, 0.5]} pos={[0, 0.25, 0]} mat={mat} />
      <Box size={[0.7, 0.3, 0.02]} pos={[0, 0.25, 0.255]} mat={MAT.hole} />
      {[-0.3, -0.1, 0.1, 0.3].map((x) => <Box key={x} size={[0.05, 0.03, 0.12]} pos={[x, 0.015, -0.3]} mat={MAT.tin} />)}
    </group>
  );
}

function BatJst() {
  return (
    <group>
      <Box size={[0.56, 0.42, 0.42]} pos={[0, 0.21, 0]} mat={MAT.white} />
      <Box size={[0.42, 0.22, 0.02]} pos={[0, 0.21, 0.215]} mat={MAT.hole} />
    </group>
  );
}

/** 雷射測距：小黑方塊，頂面兩個玻璃窗（發射與接收） */
function Tof() {
  return (
    <group>
      <Box size={[0.44, 0.12, 0.24]} pos={[0, 0.06, 0]} mat={MAT.black} />
      <Cyl r={0.045} h={0.01} pos={[-0.09, 0.125, 0]} mat={GLASS} />
      <Cyl r={0.045} h={0.01} pos={[0.09, 0.125, 0]} mat={GLASS} />
    </group>
  );
}

function FlowSensor() {
  return (
    <group>
      <Box size={[0.66, 0.08, 0.66]} pos={[0, 0.04, 0]} mat={new THREE.MeshStandardMaterial({ color: '#1f6b3a', roughness: 0.6 })} />
      <Box size={[0.42, 0.14, 0.42]} pos={[0, 0.15, 0]} mat={MAT.black} />
      <Cyl r={0.15} h={0.14} pos={[0, 0.29, 0]} mat={MAT.blackGloss} />
      <Cyl r={0.1} h={0.01} pos={[0, 0.365, 0]} mat={GLASS} />
    </group>
  );
}

/** 四顆 MOSFET：分別在四支機臂根部（相對左前那顆的位置） */
const DRV_OFF: [number, number][] = [[0, 0], [2.51, 0], [0, 3.11], [2.6, 3.11]];
function Drivers() {
  return (
    <group>
      {DRV_OFF.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Box size={[0.29, 0.1, 0.16]} pos={[0, 0.05, 0]} mat={MAT.black} />
          {[-0.09, 0.09].map((lx) => <Box key={lx} size={[0.04, 0.02, 0.06]} pos={[lx, 0.01, 0.1]} mat={MAT.tin} />)}
          <Box size={[0.04, 0.02, 0.06]} pos={[0, 0.01, -0.1]} mat={MAT.tin} />
        </group>
      ))}
    </group>
  );
}

function Buzzer() {
  return (
    <group>
      <Box size={[0.5, 0.28, 0.5]} pos={[0, 0.14, 0]} mat={MAT.blackGloss} />
      <Cyl r={0.06} h={0.01} pos={[0, 0.285, 0]} mat={MAT.hole} />
    </group>
  );
}

function renderStampflyPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'stamp': return <StampS3 />;
    case 'imu': return <SmdChip size={0.3} label={['BMI270']} />;
    case 'mag': return <SmdChip size={0.2} label={['BMM150']} />;
    case 'baro': return <SmdChip size={0.25} label={['BMP280']} />;
    case 'ina': return <SmdChip size={0.3} label={['INA3221']} />;
    case 'buzzer': return <Buzzer />;
    case 'rgb': return <group scale={1.3}><SmdLed color="#4ade80" glow={lights.L ?? 0} /></group>;
    case 'tofF':
    case 'tofD': return <Tof />;
    case 'flow': return <FlowSensor />;
    case 'drv': return <Drivers />;
    case 'groveA': return <Grove color="#d83b3b" />;
    case 'groveB': return <Grove color="#1d1f24" />;
    case 'bat': return <BatJst />;
    case 'mFL':
    case 'mFR':
    case 'mRL':
    case 'mRR': return <CorelessMotor />;
    default: return null;
  }
}

/** 綁繩測試架：底板、泡棉墊、高度尺；繩子跟著飛機伸長 */
function TestStand() {
  const tether = useRef<THREE.Mesh>(null!);
  const marker = useRef<THREE.Group>(null!);
  const target = useRef<THREE.Mesh>(null!);
  const padTop = SF_BENCH_LIFT - SF_PCB_T;
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b4250', roughness: 0.8 }), []);
  const foam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.95 }), []);
  const ruler = useLabelTexture(['60', '', '40', '', '20', '', '0 cm'], 96, 512, '#0f172a', '#f8fafc');
  const H = PHYS.tether * ALT_SCALE;
  useFrame(() => {
    const d = simVisual.drone;
    const alt = d ? d.alt * ALT_SCALE : 0;
    tether.current.visible = alt > 0.05;
    tether.current.scale.y = Math.max(0.01, alt);
    tether.current.position.y = padTop + alt / 2;
    marker.current.position.y = padTop + alt;
    const ref = useDrone.getState().telem?.ref ?? 0;
    target.current.visible = !!d && ref > 0.5;
    target.current.position.y = padTop + (ref / 100) * ALT_SCALE;
  });
  const RX = -SF_W / 2 - 0.2;
  const RZ = -SF_D / 2 + 0.4;
  return (
    <group>
      <Box size={[SF_W + 0.4, 0.12, SF_D + 0.4]} pos={[0, 0.06, 0]} mat={plate} />
      <Box size={[2.8, padTop - 0.12, 3.6]} pos={[0, 0.12 + (padTop - 0.12) / 2, 0]} mat={foam} />
      <mesh ref={tether} position={[0, padTop, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {/* 高度尺（比例縮小：1 m → 6 cm） */}
      <group position={[RX, 0, RZ]}>
        <Box size={[0.5, padTop + H + 0.3, 0.06]} pos={[0, (padTop + H + 0.3) / 2, 0]} mat={MAT.white} />
        <mesh position={[0, padTop + H / 2, 0.035]}>
          <planeGeometry args={[0.45, H]} />
          <meshBasicMaterial map={ruler} toneMapped={false} />
        </mesh>
        <group ref={marker} position={[0, padTop, 0]}>
          <Box size={[0.7, 0.06, 0.2]} pos={[0.1, 0, 0.05]} mat={new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0ea5e9', emissiveIntensity: 0.8 })} />
        </group>
        <mesh ref={target} position={[0, padTop, 0.06]} visible={false}>
          <boxGeometry args={[0.8, 0.03, 0.04]} />
          <meshBasicMaterial color="#f59e0b" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** 依飛行狀態移動整台飛機（高度＋姿態）；沒在飛時回到墊子上 */
const EULER = new THREE.Euler(0, 0, 0, 'YXZ');
function poseOf() {
  const d = simVisual.drone;
  if (!d) return { y: 0, x: 0, z: 0, yaw: 0 };
  return { y: d.alt * ALT_SCALE, x: d.pitch, z: -d.roll, yaw: -d.yaw };
}

function StampflyFly({ lift, children }: { lift: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const p = poseOf();
    g.current.position.set(0, lift + p.y, 0);
    g.current.rotation.set(p.x, p.yaw, p.z, 'YXZ');
  });
  return <group ref={g} position={[0, lift, 0]}>{children}</group>;
}

function benchXform(v: THREE.Vector3) {
  const p = poseOf();
  const lift = SF_BENCH_LIFT;
  EULER.set(p.x, p.yaw, p.z, 'YXZ');
  return v.clone().setY(v.y - lift).applyEuler(EULER).add(new THREE.Vector3(0, lift + p.y, 0));
}

/** 馬達軸頂端的高度（螺旋槳套在這裡） */
export const PROP_Y = SF_SHAFT_TOP - 0.06;

export const stampflyVisual: BoardVisual = {
  id: 'stampfly',
  pcbT: SF_PCB_T,
  edgeColor: '#101215',
  renderPart: renderStampflyPart,
  headerOf: (p) => {
    if (p.kind === 'motor') return `m${p.id.slice(1)}`;
    if (p.id === 'BAT' || p.id === 'GND3') return 'bat';
    return p.x < -0.5 ? 'groveA' : 'groveB';
  },
  makeTop: makeStampflyTop,
  makeBottom: makeStampflyBottom,
  Pcb: FramePcb,
  BenchExtras: TestStand,
  BenchFly: StampflyFly,
  benchXform,
};
