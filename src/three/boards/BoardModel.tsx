import type { Lights } from './visualTypes';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { PIN_COLORS, type BoardId, type PinDef } from '../../data/types';
import { boardData, explodeGap } from '../../data/boards/registry';
import { boardVisual } from './visuals';

export type { Lights } from './visualTypes';

export interface PinVisual { color?: string; opacity?: number; pulse?: boolean }

export interface BoardModelProps {
  board: BoardId;
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
  /** 覆寫腳位熱點位置（相對模型原點）；預設 [p.x, stage.pinY, p.z] */
  pinPos?: (p: PinDef) => [number, number, number];
  hiddenParts?: Set<string>;
  children?: ReactNode;
}

function PartGroup({ id, at, target, children, highlight, onClick, onDown, onOver }: {
  id: string;
  at: [number, number, number];
  target: [number, number, number];
  children: ReactNode;
  highlight?: string;
  onClick?: BoardModelProps['onPartClick'];
  onDown?: BoardModelProps['onPartDown'];
  onOver?: BoardModelProps['onPartOver'];
}) {
  const g = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const pulse = useRef<THREE.Mesh>(null!);
  const [bbox, setBbox] = useState<{ c: THREE.Vector3; s: THREE.Vector3 } | null>(null);

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

export function BoardModel({ board, explode = 0, lights = {}, offsets, highlights, onPartClick, onPartDown, onPartOver, pins, pinVisual, onPinOver, onPinClick, pinPos, hiddenParts, children }: BoardModelProps) {
  const data = boardData(board);
  const vis = boardVisual(board);
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((v) => v + 1)).catch(() => {});
    return () => { alive = false; };
  }, []);
  const top = useMemo(() => vis.makeTop(), [vis, fontsReady]);
  const bottom = useMemo(() => vis.makeBottom(), [vis, fontsReady]);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: vis.edgeColor, roughness: 0.8 }), [vis]);
  useEffect(() => () => { top.dispose(); bottom.dispose(); }, [top, bottom]);

  const pinsByPart = useMemo(() => {
    const m: Record<string, PinDef[]> = {};
    for (const p of data.pins) (m[vis.headerOf(p)] ??= []).push(p);
    return m;
  }, [data, vis]);

  return (
    <group>
      {/* PCB 板：頂面在 y = 0 */}
      <mesh position={[0, -vis.pcbT / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[data.w, vis.pcbT, data.d]} />
        <primitive object={edge} attach="material-0" />
        <primitive object={edge} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={top} roughness={0.55} metalness={0.05} />
        <meshStandardMaterial attach="material-3" map={bottom} roughness={0.6} />
        <primitive object={edge} attach="material-4" />
        <primitive object={edge} attach="material-5" />
      </mesh>

      {data.lesson.parts.map((p) => {
        if (hiddenParts?.has(p.id)) return null;
        const off = offsets?.[p.id];
        const target: [number, number, number] = off ?? [0, explode * p.layer * explodeGap(data), 0];
        const headerPins = pins ? pinsByPart[p.id] : undefined;
        const body = vis.renderPart(p.id, lights);
        return (
          <PartGroup
            key={`${board}:${p.id}`}
            id={p.id}
            at={p.at}
            target={target}
            highlight={highlights?.[p.id]}
            onClick={onPartClick}
            onDown={onPartDown}
            onOver={onPartOver}
          >
            {p.side === 'bottom' ? <group position={[0, -vis.pcbT, 0]} rotation={[Math.PI, 0, 0]}>{body}</group> : body}
            {headerPins?.map((pin) => {
              const pos = pinPos ? pinPos(pin) : pinTop(pin, data.stage.pinY);
              return (
                <PinHotspot
                  key={pin.id}
                  p={pin}
                  rel={[pos[0] - p.at[0], pos[1], pos[2] - p.at[2]]}
                  vis={pinVisual?.(pin)}
                  onOver={onPinOver}
                  onClick={onPinClick}
                />
              );
            })}
          </PartGroup>
        );
      })}
      {children}
    </group>
  );
}

/** 腳位在模型座標（相對板子原點）的頂端位置 */
export function pinTop(p: PinDef, y = 0.87): [number, number, number] {
  return [p.x, y, p.z];
}
