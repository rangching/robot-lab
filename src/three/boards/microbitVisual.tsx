import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EDGE_SLOTS, EDGE_PITCH, MB_W, MB_D, MB_PCB_T, MB_FOOTPRINTS, MB_LIFT, RING_HOLE_R, RING_Y, RINGS, edgeX, ledMm, slotX } from '../../data/boards/microbit';
import { mbVisual } from '../../sim/microbit';
import { Box, Cyl, MAT, SmdChip, SmdLed, TactButton } from '../parts/primitives';
import { MB_CORNER, NOTCH_D, NOTCH_W, STRIP_LEN, makeMicrobitBottom, makeMicrobitTop, notchXs, ringSpan } from './microbitTexture';
import type { BoardVisual, Lights } from './visualTypes';

const cm = (mm: number) => mm / 10;
/** 圖面 mm → Shape 座標（u＝x、v＝遠方＝ −z） */
const su = (mm: number) => cm(mm) - MB_W / 2;
const sv = (mm: number) => cm(mm) - MB_D / 2;

/** 圓角板子：五個圓環挖真的孔，V2 圓環兩側有缺口 */
function MicrobitPcb({ top, bottom, edge }: { top: THREE.Texture; bottom: THREE.Texture; edge: THREE.Material }) {
  const geo = useMemo(() => {
    const r = cm(MB_CORNER);
    const hw = MB_W / 2;
    const hd = MB_D / 2;
    const s = new THREE.Shape();
    s.moveTo(-hw + r, -hd);
    // 下緣（金手指）由左到右，遇到缺口往內切
    for (const x of notchXs()) {
      const a = su(x - NOTCH_W / 2);
      const b = su(x + NOTCH_W / 2);
      const d = -hd + cm(NOTCH_D);
      s.lineTo(a, -hd);
      s.lineTo(a, d);
      s.lineTo(b, d);
      s.lineTo(b, -hd);
    }
    s.lineTo(hw - r, -hd);
    s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
    s.lineTo(hw, hd - r);
    s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
    s.lineTo(-hw + r, hd);
    s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-hw, -hd + r);
    s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
    for (const id of RINGS) {
      const h = new THREE.Path();
      h.absarc(su(edgeX(id, true)), sv(RING_Y), cm(RING_HOLE_R), 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return new THREE.ExtrudeGeometry(s, { depth: MB_PCB_T, bevelEnabled: false, curveSegments: 24 });
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={edge} rotation={[-Math.PI / 2, 0, 0]} position={[0, -MB_PCB_T, 0]} castShadow receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[MB_W, MB_D]} />
        <meshStandardMaterial map={top} alphaTest={0.5} roughness={0.45} metalness={0.08} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -MB_PCB_T - 0.003, 0]}>
        <planeGeometry args={[MB_W, MB_D]} />
        <meshStandardMaterial map={bottom} alphaTest={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 5×5 LED：每幀讀 mbVisual.matrix 調整發光強度 */
function LedMatrix() {
  const mats = useMemo(() => Array.from({ length: 25 }, () => new THREE.MeshStandardMaterial({ color: '#e8e2d2', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.35, toneMapped: false })), []);
  const last = useRef<number[]>([]);
  useFrame(() => {
    const m = mbVisual.matrix;
    for (let i = 0; i < 25; i++) {
      const v = m[i] ?? 0;
      if (last.current[i] === v) continue;
      last.current[i] = v;
      mats[i].emissiveIntensity = (v / 9) * 5;
      mats[i].color.set(v > 0 ? '#ff6a5a' : '#e8e2d2');
    }
  });
  const [cx, cy] = MB_FOOTPRINTS.matrix;
  return (
    <group>
      {mats.map((mat, i) => {
        const [x, y] = ledMm(i % 5, Math.floor(i / 5));
        return (
          <group key={i} position={[cm(x - cx), 0, -cm(y - cy)]}>
            <Box size={[0.17, 0.02, 0.1]} pos={[0, 0.01, 0]} mat={MAT.tin} />
            <mesh position={[0, 0.045, 0]} material={mat}>
              <boxGeometry args={[0.12, 0.05, 0.08]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** 麥克風指示燈：程式用到麥克風就亮 */
function MicLed() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e2d2', emissive: '#ff2a1a', emissiveIntensity: 0, toneMapped: false }), []);
  useFrame(() => {
    mat.emissiveIntensity = mbVisual.mic ? 4 : 0;
  });
  return (
    <group>
      <Box size={[0.16, 0.02, 0.09]} pos={[0, 0.01, 0]} mat={MAT.tin} />
      <mesh position={[0, 0.04, 0]} material={mat}><boxGeometry args={[0.1, 0.04, 0.07]} /></mesh>
    </group>
  );
}

/** 觸控 logo：金色的圓角外框＋兩個點（貼圖上也有，這裡讓它在爆炸圖裡看得到） */
function Logo() {
  const geo = useMemo(() => {
    const [, , w, h] = MB_FOOTPRINTS.logo;
    const W = cm(w) / 2;
    const R = cm(h) / 2;
    const ring = (rw: number, rr: number, dir: boolean) => {
      const p = new THREE.Shape();
      p.moveTo(-rw + rr, -rr);
      p.lineTo(rw - rr, -rr);
      p.absarc(rw - rr, 0, rr, -Math.PI / 2, Math.PI / 2, !dir);
      p.lineTo(-rw + rr, rr);
      p.absarc(-rw + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, !dir);
      return p;
    };
    const s = ring(W, R, true);
    s.holes.push(ring(W - 0.075, R - 0.075, false) as unknown as THREE.Path);
    return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 20 });
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={MAT.gold} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} />
      {[-0.18, 0.18].map((x) => <Cyl key={x} r={0.075} h={0.008} pos={[x, 0.006, 0]} mat={MAT.gold} />)}
    </group>
  );
}

/** 金手指：窄條＋圓環（貼圖也有；這裡做出一點厚度與金屬光澤） */
function EdgeConnector() {
  const [cx, cy] = MB_FOOTPRINTS.edge;
  const ringGeo = useMemo(() => new THREE.RingGeometry(cm(RING_HOLE_R), cm(RING_HOLE_R) + 0.045, 40), []);
  return (
    <group>
      {EDGE_SLOTS.map((s, i) =>
        s.ring ? null : <Box key={i} size={[cm(EDGE_PITCH * 0.62), 0.006, cm(STRIP_LEN)]} pos={[cm(slotX(i) - cx), 0.004, -cm(STRIP_LEN / 2 - cy)]} mat={MAT.gold} />,
      )}
      {RINGS.map((id) => {
        const [a, b] = ringSpan(id);
        const x = cm(edgeX(id, true) - cx);
        return (
          <group key={id}>
            <mesh geometry={ringGeo} material={MAT.gold} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.007, -cm(RING_Y - cy)]} />
            <Box size={[cm(b - a - 0.3), 0.006, cm(RING_Y - RING_HOLE_R)]} pos={[x, 0.004, -cm((RING_Y - RING_HOLE_R) / 2 - cy)]} mat={MAT.gold} />
          </group>
        );
      })}
    </group>
  );
}

const SPEAKER = new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.6 });
const JST = new THREE.MeshStandardMaterial({ color: '#f1efe6', roughness: 0.5 });
/** 背面朝下時主光照不到，金屬度太高會變全黑，所以 USB 外殼用較低的金屬度 */
const USB_SHELL = new THREE.MeshStandardMaterial({ color: '#b8bfc7', roughness: 0.4, metalness: 0.45 });

/** Micro-USB：開口朝遠方（−z），前端稍微伸出板邊 */
function MicroUsb() {
  return (
    <group>
      <Box size={[0.76, 0.27, 0.56]} pos={[0, 0.135, 0]} mat={USB_SHELL} />
      <Box size={[0.6, 0.16, 0.02]} pos={[0, 0.14, -0.281]} mat={MAT.hole} />
      <Box size={[0.42, 0.05, 0.3]} pos={[0, 0.14, -0.14]} mat={MAT.black} />
    </group>
  );
}

/** JST-PH 電池接頭：白色塑膠，開口朝遠方 */
function BatteryJst() {
  return (
    <group>
      <Box size={[0.78, 0.45, 0.55]} pos={[0, 0.225, 0]} mat={JST} />
      <Box size={[0.6, 0.3, 0.02]} pos={[0, 0.25, -0.28]} mat={MAT.hole} />
    </group>
  );
}

function Speaker() {
  return (
    <group>
      <Cyl r={0.55} h={0.26} pos={[0, 0.13, 0]} mat={SPEAKER} />
      <Cyl r={0.08} h={0.01} pos={[0, 0.265, 0]} mat={MAT.hole} />
      {[-0.42, 0.42].map((x) => <Box key={x} size={[0.12, 0.02, 0.2]} pos={[x, 0.01, 0.52]} mat={MAT.tin} />)}
    </group>
  );
}

/** 2.4 GHz 天線：電路板上彎來彎去的銅箔（和背面貼圖的走線對齊） */
function Antenna() {
  const segs: [number, number, number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const x = -0.4 + k * 0.2;
    segs.push([x, -0.3, x, 0.35], [x, 0.35, x + 0.1, 0.35], [x + 0.1, 0.35, x + 0.1, -0.3], [x + 0.1, -0.3, x + 0.2, -0.3]);
  }
  return (
    <group>
      {segs.map(([x0, y0, x1, y1], i) => (
        <Box key={i} size={[Math.abs(x1 - x0) + 0.06, 0.004, Math.abs(y1 - y0) + 0.06]} pos={[(x0 + x1) / 2, 0.002, -(y0 + y1) / 2]} mat={MAT.gold} />
      ))}
    </group>
  );
}

function renderMicrobitPart(id: string, _lights: Lights): ReactNode {
  switch (id) {
    case 'matrix': return <LedMatrix />;
    case 'btnA':
    case 'btnB': return <TactButton />;
    case 'logo': return <Logo />;
    case 'micLed': return <MicLed />;
    case 'edge': return <EdgeConnector />;
    case 'mcu': return <SmdChip size={0.7} label={['N52833']} />;
    case 'iface': return <SmdChip size={0.5} label={['N52820']} />;
    case 'motion': return <SmdChip size={0.2} label={['']} />;
    case 'speaker': return <Speaker />;
    case 'mic': return <Box size={[0.35, 0.1, 0.26]} pos={[0, 0.05, 0]} mat={MAT.silver} />;
    case 'usb': return <MicroUsb />;
    case 'battery': return <BatteryJst />;
    case 'reset': return <group scale={0.7}><TactButton /></group>;
    case 'antenna': return <Antenna />;
    case 'reg': return <SmdChip size={0.3} label={['3V3']} />;
    case 'leds':
      return (
        <group>
          <group position={[-0.06, 0, 0]} scale={0.7}><SmdLed color="#ff3030" glow={1} /></group>
          <group position={[0.1, 0, 0]} scale={0.7}><SmdLed color="#ffb020" glow={0} /></group>
        </group>
      );
    default: return null;
  }
}

/** 傾斜角：滿刻度 1024 毫 g 畫成 35° */
const MAX_TILT = (35 * Math.PI) / 180;
function tiltEuler(t = performance.now()) {
  const shake = t < mbVisual.shakeUntil ? Math.sin(t / 28) * 0.18 : 0;
  // y 正＝金手指那邊（+z）壓低 → 繞 x 軸正轉；x 正＝右邊壓低 → 繞 z 軸負轉
  return new THREE.Euler((mbVisual.tiltY / 1024) * MAX_TILT, 0, -(mbVisual.tiltX / 1024) * MAX_TILT + shake);
}
/** 板子傾斜時要抬高，邊緣才不會插進桌面（像用手拿起來） */
function tiltRaise(e: THREE.Euler) {
  return Math.max(Math.abs(Math.sin(e.z)) * (MB_W / 2), Math.abs(Math.sin(e.x)) * (MB_D / 2)) * 1.05;
}

function MicrobitTilt({ lift, children }: { lift: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const e = tiltEuler();
    g.current.rotation.copy(e);
    g.current.position.set(0, lift + tiltRaise(e), 0);
  });
  return <group ref={g} position={[0, lift, 0]}>{children}</group>;
}

function benchXform(v: THREE.Vector3) {
  const e = tiltEuler(0);
  return v.clone().setY(v.y - MB_LIFT).applyEuler(e).add(new THREE.Vector3(0, MB_LIFT + tiltRaise(e), 0));
}

export const microbitVisual: BoardVisual = {
  id: 'microbit',
  pcbT: MB_PCB_T,
  edgeColor: '#101114',
  renderPart: renderMicrobitPart,
  headerOf: () => 'edge',
  makeTop: makeMicrobitTop,
  makeBottom: makeMicrobitBottom,
  Pcb: MicrobitPcb,
  BenchFly: MicrobitTilt,
  benchXform,
};
