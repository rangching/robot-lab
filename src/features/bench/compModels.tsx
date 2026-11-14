import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG } from '../../sim/catalog';
import type { Comp } from '../../sim/types';
import { simVisual } from '../../sim/engine';
import { Box, Cyl, MAT } from '../../three/parts/primitives';

export const PIN_TOP = 0.34;

function useModuleTexture(c: Comp) {
  const spec = CATALOG[c.type];
  return useMemo(() => {
    const ppu = 220;
    const cv = document.createElement('canvas');
    cv.width = Math.round(spec.w * ppu);
    cv.height = Math.round(spec.d * ppu);
    const g = cv.getContext('2d')!;
    g.fillStyle = c.type === 'hcsr04' || c.type === 'pot' ? '#103a63' : c.type === 'psu' ? '#1b1d22' : '#0f2a35';
    g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = 4;
    g.strokeRect(6, 6, cv.width - 12, cv.height - 12);
    g.fillStyle = 'rgba(235,245,250,.92)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.round(ppu * 0.15)}px "JetBrains Mono", monospace`;
    for (const p of spec.pins) {
      g.fillText(p.label, (p.dx + spec.w / 2) * ppu, (p.dz + spec.d / 2 - 0.26) * ppu);
    }
    const title = c.type === 'resistor' ? `${(c.props.ohms ?? 220) >= 1000 ? `${(c.props.ohms ?? 220) / 1000}kΩ` : `${c.props.ohms ?? 220}Ω`}` : spec.short;
    g.font = `700 ${Math.round(ppu * 0.14)}px "Noto Sans TC", sans-serif`;
    g.fillStyle = 'rgba(235,245,250,.6)';
    g.textAlign = 'left';
    g.fillText(title, 0.1 * ppu, 0.15 * ppu);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [c.type, c.props.ohms, spec]);
}

/** 模組底板＋本體（不含接線端子） */
export function CompBody({ c }: { c: Comp }) {
  const spec = CATALOG[c.type];
  const tex = useModuleTexture(c);
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.w, 0.1, spec.d]} />
        <meshStandardMaterial attach="material-0" color="#0b1a22" />
        <meshStandardMaterial attach="material-1" color="#0b1a22" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.6} />
        <meshStandardMaterial attach="material-3" color="#0b1a22" />
        <meshStandardMaterial attach="material-4" color="#0b1a22" />
        <meshStandardMaterial attach="material-5" color="#0b1a22" />
      </mesh>
      <group position={[0, 0.1, 0]}>
        {c.type === 'led' && <LedBody c={c} />}
        {c.type === 'resistor' && <ResistorBody c={c} />}
        {c.type === 'button' && <ButtonBody c={c} />}
        {c.type === 'pot' && <PotBody c={c} />}
        {c.type === 'buzzer' && <BuzzerBody c={c} />}
        {c.type === 'servo' && <ServoBody c={c} />}
        {c.type === 'hcsr04' && <SonarBody c={c} />}
        {c.type === 'psu' && <PsuBody />}
      </group>
    </group>
  );
}

function LedBody({ c }: { c: Comp }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const color = c.props.color ?? '#ff3b4f';
  useFrame(() => {
    const b = simVisual.running ? simVisual.led[c.id] ?? 0 : 0;
    mat.current.emissiveIntensity = 0.05 + b * 5;
    light.current.intensity = b * 3;
  });
  return (
    <group position={[0, 0, -0.2]}>
      <Cyl r={0.3} h={0.08} pos={[0, 0.04, 0]} mat={MAT.white} />
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.4, 24]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.05} transparent opacity={0.85} roughness={0.15} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      <pointLight ref={light} color={color} distance={4} intensity={0} position={[0, 0.9, 0]} />
      {/* 長腳＋、短腳− */}
      <Box size={[0.03, 0.02, 0.5]} pos={[-0.3 + 0.0, 0.02, 0.45]} mat={MAT.tin} />
      <Box size={[0.03, 0.02, 0.35]} pos={[0.3, 0.02, 0.5]} mat={MAT.tin} />
    </group>
  );
}

const BAND: Record<string, string[]> = { '220': ['#e0362c', '#e0362c', '#6b3b1f'], '10000': ['#6b3b1f', '#111111', '#ff9a1f'] };

function ResistorBody({ c }: { c: Comp }) {
  const bands = BAND[String(c.props.ohms ?? 220)] ?? BAND['220'];
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9c39a', roughness: 0.5 }), []);
  return (
    <group position={[0, 0.2, -0.1]}>
      <Cyl r={0.16} h={0.9} rot={[0, 0, Math.PI / 2]} mat={body} />
      {bands.map((b, i) => (
        <mesh key={i} position={[-0.25 + i * 0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.165, 0.165, 0.07, 20]} />
          <meshStandardMaterial color={b} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.165, 0.165, 0.07, 20]} />
        <meshStandardMaterial color="#c9a54a" metalness={0.8} roughness={0.3} />
      </mesh>
      <Box size={[0.32, 0.03, 0.03]} pos={[-0.6, -0.1, 0.1]} mat={MAT.tin} />
      <Box size={[0.32, 0.03, 0.03]} pos={[0.6, -0.1, 0.1]} mat={MAT.tin} />
    </group>
  );
}

function ButtonBody({ c }: { c: Comp }) {
  const cap = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const p = simVisual.pressed[c.id];
    cap.current.position.y += ((p ? 0.2 : 0.3) - cap.current.position.y) * 0.4;
  });
  return (
    <group position={[0, 0, -0.15]}>
      <Box size={[0.8, 0.2, 0.8]} pos={[0, 0.1, 0]} mat={MAT.steel} />
      <mesh ref={cap} position={[0, 0.3, 0]} castShadow userData={{ press: c.id }}>
        <cylinderGeometry args={[0.26, 0.26, 0.2, 24]} />
        <meshStandardMaterial color="#e94b5b" roughness={0.4} />
      </mesh>
    </group>
  );
}

function PotBody({ c }: { c: Comp }) {
  const knob = useRef<THREE.Group>(null!);
  useFrame(() => {
    const v = simVisual.pot[c.id] ?? 0.5;
    knob.current.rotation.y = THREE.MathUtils.lerp(knob.current.rotation.y, (0.5 - v) * Math.PI * 1.5, 0.3);
  });
  return (
    <group position={[0, 0, -0.15]}>
      <Box size={[1.0, 0.25, 1.0]} pos={[0, 0.125, 0]} mat={new THREE.MeshStandardMaterial({ color: '#2b6cb0', roughness: 0.5 })} />
      <group ref={knob} position={[0, 0.25, 0]}>
        <Cyl r={0.34} h={0.32} pos={[0, 0.16, 0]} mat={MAT.blackGloss} />
        <Box size={[0.06, 0.02, 0.28]} pos={[0, 0.33, -0.14]} mat={MAT.white} />
      </group>
    </group>
  );
}

function BuzzerBody({ c }: { c: Comp }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((s) => {
    const f = simVisual.running ? simVisual.buzz[c.id] ?? 0 : 0;
    const k = f > 0 ? 1 + Math.sin(s.clock.elapsedTime * 80) * 0.03 : 1;
    g.current.scale.set(k, 1, k);
  });
  return (
    <group ref={g} position={[0, 0, -0.15]}>
      <Cyl r={0.48} h={0.45} pos={[0, 0.225, 0]} mat={MAT.blackGloss} />
      <Cyl r={0.08} h={0.01} pos={[0, 0.455, 0]} mat={MAT.hole} />
    </group>
  );
}

function ServoBody({ c }: { c: Comp }) {
  const horn = useRef<THREE.Group>(null!);
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6fd6', roughness: 0.35, transparent: true, opacity: 0.92 }), []);
  useFrame(() => {
    const s = simVisual.servo[c.id];
    const a = s ? s.angle : 90;
    horn.current.rotation.y = THREE.MathUtils.degToRad(90 - a);
  });
  return (
    <group position={[0, 0, -0.25]}>
      <Box size={[1.6, 0.9, 0.85]} pos={[0, 0.45, 0]} mat={blue} />
      <Box size={[2.2, 0.08, 0.85]} pos={[0, 0.7, 0]} mat={blue} />
      <Cyl r={0.26} h={0.25} pos={[-0.45, 1.0, 0]} mat={blue} />
      <group ref={horn} position={[-0.45, 1.16, 0]}>
        <Cyl r={0.14} h={0.1} pos={[0, 0, 0]} mat={MAT.white} />
        <Box size={[1.1, 0.07, 0.18]} pos={[0.45, 0, 0]} mat={MAT.white} />
      </group>
      {/* 三色線 */}
      <Box size={[0.07, 0.05, 0.5]} pos={[-0.6, 0.06, 0.6]} mat={new THREE.MeshStandardMaterial({ color: '#7a4a2a' })} />
      <Box size={[0.07, 0.05, 0.5]} pos={[0, 0.06, 0.6]} mat={new THREE.MeshStandardMaterial({ color: '#e0362c' })} />
      <Box size={[0.07, 0.05, 0.5]} pos={[0.6, 0.06, 0.6]} mat={new THREE.MeshStandardMaterial({ color: '#ff9a1f' })} />
    </group>
  );
}

function SonarBody({ c }: { c: Comp }) {
  const rings = useRef<THREE.Group>(null!);
  const wall = useRef<THREE.Group>(null!);
  useFrame(() => {
    const dist = simVisual.distance;
    const wz = -1.1 - dist * 0.035;
    wall.current.position.z = THREE.MathUtils.lerp(wall.current.position.z, wz, 0.25);
    const last = simVisual.sonar[c.id] ?? 0;
    const age = (performance.now() - last) / 1000;
    rings.current.children.forEach((r, i) => {
      const a = age - i * 0.06;
      const on = simVisual.running && a > 0 && a < 0.45;
      r.visible = on;
      const t = Math.max(0, a / 0.45);
      r.position.z = -0.55 + (wz + 0.55) * t;
      r.scale.setScalar(0.5 + t * 1.2);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
    });
  });
  return (
    <group>
      {[-1.05, 1.05].map((x) => (
        <group key={x} position={[x, 0.45, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <Cyl r={0.55} h={0.6} mat={MAT.silver} />
          <Cyl r={0.45} h={0.62} mat={new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.9 })} />
        </group>
      ))}
      <Box size={[0.5, 0.25, 0.3]} pos={[0, 0.13, -0.1]} mat={MAT.silver} />
      <group ref={rings}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, 0]} position={[0, 0.45, -0.6]}>
            <torusGeometry args={[0.6, 0.025, 6, 40, Math.PI]} />
            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.6} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* 障礙物 */}
      <group ref={wall} position={[0, 0, -2.5]}>
        <Box size={[3, 1.4, 0.2]} pos={[0, 0.7, 0]} mat={new THREE.MeshStandardMaterial({ color: '#ff9f43', roughness: 0.6, transparent: true, opacity: 0.55 })} />
      </group>
    </group>
  );
}

function PsuBody() {
  const green = useMemo(() => new THREE.MeshStandardMaterial({ color: '#36a852', roughness: 0.4 }), []);
  return (
    <group position={[0, 0, -0.2]}>
      <Box size={[2.2, 0.35, 1.0]} pos={[0, 0.175, 0]} mat={MAT.black} />
      {[-0.75, -0.25, 0.25, 0.75].map((x) => (
        <group key={x}>
          <Cyl r={0.2} h={0.9} rot={[Math.PI / 2, 0, 0]} pos={[x, 0.45, 0]} mat={green} />
        </group>
      ))}
      <Box size={[0.12, 0.06, 0.12]} pos={[0.9, 0.38, 0.4]} mat={new THREE.MeshStandardMaterial({ color: '#ff3040', emissive: '#ff3040', emissiveIntensity: 2, toneMapped: false })} />
    </group>
  );
}
