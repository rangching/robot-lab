import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { UNO_PINS, UNO_W, UNO_D, PCB_T, unoLesson, mx } from '../../data/boards/uno';
import { PIN_COLORS, type PinDef } from '../../data/types';
import { makeTopTexture, makeBottomTexture } from './pcbTexture';
import { BarrelJack, Crystal, DipChip, ElectroCap, FemaleHeader, MaleHeader, Regulator, SmdChip, SmdLed, TactButton, UsbB } from '../parts/primitives';

export interface Lights { L?: number; TX?: number; RX?: number; ON?: number }

export interface PinVisual { color?: string; opacity?: number; pulse?: boolean }

export interface UnoModelProps {
  explode?: number;
  lights?: Lights;
  /** 零件的額外位移（組裝模式用），key = part id */
  offsets?: Record<string, [number, number, number]>;
  /** 要發光提示的零件：id → 顏色 */
  highlights?: Record<string, string>;
  onPartClick?: (id: string, e: ThreeEvent<MouseEvent>) => void;
  onPartDown?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onPartOver?: (id: string | null) => void;
  /** 腳位熱點 */
  pins?: boolean;
  pinVisual?: (p: PinDef) => PinVisual | undefined;
  onPinOver?: (p: PinDef | null) => void;
  onPinClick?: (p: PinDef) => void;
  hiddenParts?: Set<string>;
  children?: ReactNode;
}

const PART_AT: Record<string, [number, number, number]> = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p.at]));
const PART_LAYER: Record<string, number> = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p.layer]));
const HEADER_OF = (p: PinDef) => (p.z < 0 ? 'dig' : p.x < mx(45) ? 'pwr' : 'ana');

function renderPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <DipChip />;
    case 'usb': return <UsbB />;
    case 'u2': return <SmdChip size={0.5} label={['ATMEGA', '16U2']} />;
    case 'jack': return <BarrelJack />;
    case 'reg': return <Regulator />;
    case 'caps':
      return (
        <>
          <group position={[0.45, 0, -0.1]}><ElectroCap /></group>
          <group position={[-0.1, 0, -0.45]}><ElectroCap /></group>
        </>
      );
    case 'dig':
      return (
        <>
          <group position={[(21.4 + 4.5 * 2.54 - 44) / 10, 0, 0]}><FemaleHeader n={10} /></group>
          <group position={[(48.3 + 3.5 * 2.54 - 44) / 10, 0, 0]}><FemaleHeader n={8} /></group>
        </>
      );
    case 'pwr': return <FemaleHeader n={8} />;
    case 'ana': return <FemaleHeader n={6} />;
    case 'ledL': return <SmdLed color="#ffae1a" glow={lights.L ?? 0} />;
    case 'txrx':
      return (
        <>
          <group position={[0, 0, -0.14]}><SmdLed color="#ffd23a" glow={lights.TX ?? 0} /></group>
          <group position={[0, 0, 0.14]}><SmdLed color="#ffd23a" glow={lights.RX ?? 0} /></group>
        </>
      );
    case 'on': return <SmdLed color="#3dff6b" glow={lights.ON ?? 0} />;
    case 'reset': return <TactButton />;
    case 'xtal': return <Crystal />;
    case 'icsp': return <MaleHeader cols={2} rows={3} />;
    default: return null;
  }
}

function PartGroup({ id, target, children, highlight, onClick, onDown, onOver }: {
  id: string;
  target: [number, number, number];
  children: ReactNode;
  highlight?: string;
  onClick?: UnoModelProps['onPartClick'];
  onDown?: UnoModelProps['onPartDown'];
  onOver?: UnoModelProps['onPartOver'];
}) {
  const g = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const pulse = useRef<THREE.Mesh>(null!);
  const [bbox, setBbox] = useState<{ c: THREE.Vector3; s: THREE.Vector3 } | null>(null);
  const at = PART_AT[id];

  useLayoutEffect(() => {
    g.current.position.set(at[0] + target[0], target[1], at[2] + target[2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    inner.current.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(inner.current);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    b.getCenter(c);
    b.getSize(s);
    inner.current.worldToLocal(c);
    // Box3 以世界座標計算；只需要尺寸與相對中心
    setBbox({ c: c.clone(), s: s.clone() });
  }, []);

  useFrame((state, dt) => {
    const p = g.current.position;
    const k = 1 - Math.pow(0.0008, dt);
    p.x += (at[0] + target[0] - p.x) * k;
    p.y += (target[1] - p.y) * k;
    p.z += (at[2] + target[2] - p.z) * k;
    if (pulse.current) {
      const m = pulse.current.material as THREE.MeshBasicMaterial;
      m.opacity = highlight ? 0.2 + 0.16 * Math.sin(state.clock.elapsedTime * 6) : 0;
      if (highlight) m.color.set(highlight);
      pulse.current.visible = !!highlight;
    }
  });

  return (
    <group
      ref={g}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(id, e); } : undefined}
      onPointerDown={onDown ? (e) => { e.stopPropagation(); onDown(id, e); } : undefined}
      onPointerOver={onOver ? (e) => { e.stopPropagation(); onOver(id); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={onOver ? () => { onOver(null); document.body.style.cursor = ''; } : undefined}
    >
      <group ref={inner}>{children}</group>
      {bbox && (
        <mesh ref={pulse} position={bbox.c} visible={false} raycast={() => null}>
          <boxGeometry args={[bbox.s.x + 0.14, bbox.s.y + 0.14, bbox.s.z + 0.14]} />
          <meshBasicMaterial color="#22e3ff" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function PinHotspot({ p, rel, vis, onOver, onClick }: { p: PinDef; rel: [number, number, number]; vis?: PinVisual; onOver?: (p: PinDef | null) => void; onClick?: (p: PinDef) => void }) {
  const m = useRef<THREE.Mesh>(null!);
  const [hover, setHover] = useState(false);
  useFrame((s) => {
    const mat = m.current.material as THREE.MeshBasicMaterial;
    const base = vis?.opacity ?? 0;
    const pul = vis?.pulse ? 0.35 + 0.35 * Math.sin(s.clock.elapsedTime * 8) : 0;
    mat.opacity = hover ? 0.95 : Math.min(1, base + pul);
    mat.color.set(vis?.color ?? PIN_COLORS[p.kind]);
    const sc = hover ? 1.5 : 1;
    m.current.scale.set(sc, 1, sc);
  });
  return (
    <mesh
      ref={m}
      position={rel}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); onOver?.(p); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); onOver?.(null); document.body.style.cursor = ''; }}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(p); } : undefined}
    >
      <boxGeometry args={[0.2, 0.05, 0.2]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function UnoModel({ explode = 0, lights = {}, offsets, highlights, onPartClick, onPartDown, onPartOver, pins, pinVisual, onPinOver, onPinClick, hiddenParts, children }: UnoModelProps) {
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((v) => v + 1)).catch(() => {});
    return () => { alive = false; };
  }, []);
  const top = useMemo(() => makeTopTexture(), [fontsReady]);
  const bottom = useMemo(() => makeBottomTexture(), [fontsReady]);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0e3b47', roughness: 0.8 }), []);

  const pinsByHeader = useMemo(() => {
    const m: Record<string, PinDef[]> = { dig: [], pwr: [], ana: [] };
    for (const p of UNO_PINS) m[HEADER_OF(p)].push(p);
    return m;
  }, []);

  return (
    <group>
      {/* PCB 板：頂面在 y = 0 */}
      <mesh position={[0, -PCB_T / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[UNO_W, PCB_T, UNO_D]} />
        <meshStandardMaterial attach="material-0" {...{ color: '#0e3b47', roughness: 0.8 }} />
        <meshStandardMaterial attach="material-1" {...{ color: '#0e3b47', roughness: 0.8 }} />
        <meshStandardMaterial attach="material-2" map={top} roughness={0.55} metalness={0.05} />
        <meshStandardMaterial attach="material-3" map={bottom} roughness={0.6} />
        <primitive object={edge} attach="material-4" />
        <primitive object={edge} attach="material-5" />
      </mesh>

      {unoLesson.parts.map((p) => {
        if (hiddenParts?.has(p.id)) return null;
        const off = offsets?.[p.id];
        const target: [number, number, number] = off ?? [0, explode * PART_LAYER[p.id] * 0.9, 0];
        const headerPins = pins ? pinsByHeader[p.id] : undefined;
        return (
          <PartGroup
            key={p.id}
            id={p.id}
            target={target}
            highlight={highlights?.[p.id]}
            onClick={onPartClick}
            onDown={onPartDown}
            onOver={onPartOver}
          >
            {renderPart(p.id, lights)}
            {headerPins?.map((pin) => (
              <PinHotspot
                key={pin.id}
                p={pin}
                rel={[pin.x - p.at[0], 0.87, pin.z - p.at[2]]}
                vis={pinVisual?.(pin)}
                onOver={onPinOver}
                onClick={onPinClick}
              />
            ))}
          </PartGroup>
        );
      })}
      {children}
    </group>
  );
}

/** 腳位在世界座標（相對板子原點）的頂端位置 */
export function pinTop(p: PinDef): [number, number, number] {
  return [p.x, 0.87, p.z];
}
