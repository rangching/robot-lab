import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { UnoModel, type Lights } from '../../three/boards/UnoModel';
import { DragController } from '../../three/DragController';
import { UNO_PIN_MAP } from '../../data/boards/uno';
import { PIN_COLORS, PIN_KIND_LABEL, type PinDef } from '../../data/types';
import { CATALOG } from '../../sim/catalog';
import { simVisual } from '../../sim/engine';
import { splitEp, type Comp, type Endpoint } from '../../sim/types';
import { UNO_POS, useBench } from './benchStore';
import { CompBody, PIN_TOP } from './compModels';
import { IconTrash } from '../../lib/icons';

export function epPos(e: Endpoint, comps: Comp[]): THREE.Vector3 | null {
  const [o, p] = splitEp(e);
  if (o === 'uno') {
    const pin = UNO_PIN_MAP[p];
    return pin ? new THREE.Vector3(UNO_POS[0] + pin.x, 0.87, UNO_POS[2] + pin.z) : null;
  }
  const c = comps.find((x) => x.id === o);
  if (!c) return null;
  const sp = CATALOG[c.type].pins.find((x) => x.id === p);
  return sp ? new THREE.Vector3(c.x + sp.dx, PIN_TOP, c.z + sp.dz) : null;
}

function epLabel(e: Endpoint, comps: Comp[]) {
  const [o, p] = splitEp(e);
  if (o === 'uno') {
    const pin = UNO_PIN_MAP[p];
    return { title: `Uno ${pin?.label ?? p}`, sub: pin ? `${PIN_KIND_LABEL[pin.kind]} · ${pin.desc}` : '' };
  }
  const c = comps.find((x) => x.id === o);
  if (!c) return { title: e, sub: '' };
  const spec = CATALOG[c.type];
  const sp = spec.pins.find((x) => x.id === p);
  const extra: Record<string, string> = { A: '長腳（陽極）', K: '短腳（陰極）', W: '中間腳（滑臂）', V: '紅線', SIG: '橘線（訊號）' };
  return { title: `${spec.name} ${sp?.label ?? p}`, sub: (c.type === 'servo' && p === 'GND' ? '棕線' : extra[p]) ?? spec.desc };
}

function WireMesh({ id, a, b, color, onRemove, danger }: { id: string; a: THREE.Vector3; b: THREE.Vector3; color: string; onRemove: (id: string) => void; danger: boolean }) {
  const [hover, setHover] = useState(false);
  const geom = useMemo(() => {
    const d = a.distanceTo(b);
    const lift = 0.7 + d * 0.12;
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + lift;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().setY(a.y + 0.35), mid, b.clone().setY(b.y + 0.35), b]);
    return new THREE.TubeGeometry(curve, 48, 0.05, 8, false);
  }, [a.x, a.y, a.z, b.x, b.y, b.z]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh
      geometry={geom}
      castShadow
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      onClick={(e) => { e.stopPropagation(); onRemove(id); }}
    >
      <meshStandardMaterial color={hover ? '#ff4d6d' : color} emissive={danger ? '#ff4d6d' : hover ? '#ff4d6d' : color} emissiveIntensity={danger ? 1.2 : hover ? 0.8 : 0.18} roughness={0.45} />
    </mesh>
  );
}

function Terminal({ e, pos, color, state, onOver, onClick }: { e: Endpoint; pos: THREE.Vector3; color: string; state: 'none' | 'pending' | 'error'; onOver: (e: Endpoint | null) => void; onClick: (e: Endpoint) => void }) {
  const m = useRef<THREE.Mesh>(null!);
  const [hover, setHover] = useState(false);
  useFrame((s) => {
    const mat = m.current.material as THREE.MeshStandardMaterial;
    const pul = 0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 9);
    if (state === 'error') { mat.emissive.set('#ff2040'); mat.emissiveIntensity = 0.6 + pul * 2; }
    else if (state === 'pending') { mat.emissive.set('#7cff6b'); mat.emissiveIntensity = 0.8 + pul * 2; }
    else if (hover) { mat.emissive.set('#22e3ff'); mat.emissiveIntensity = 1.5; }
    else { mat.emissive.set(color); mat.emissiveIntensity = 0.12; }
    const sc = hover || state !== 'none' ? 1.3 : 1;
    m.current.scale.set(sc, 1, sc);
  });
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh ref={m} position={[0, PIN_TOP - 0.12, 0]} castShadow>
        <boxGeometry args={[0.18, 0.24, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} toneMapped={false} />
      </mesh>
      {/* 比較大的隱形點擊範圍 */}
      <mesh
        position={[0, PIN_TOP - 0.1, 0]}
        onPointerOver={(ev) => { ev.stopPropagation(); setHover(true); onOver(e); document.body.style.cursor = 'crosshair'; }}
        onPointerOut={() => { setHover(false); onOver(null); document.body.style.cursor = ''; }}
        onClick={(ev) => { ev.stopPropagation(); onClick(e); }}
      >
        <boxGeometry args={[0.42, 0.4, 0.42]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PendingWire({ from }: { from: THREE.Vector3 }) {
  const { camera, gl } = useThree();
  const [to, setTo] = useState<THREE.Vector3>(from.clone());
  useEffect(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
    const rc = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const mv = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(v, camera);
      if (rc.ray.intersectPlane(plane, hit)) setTo(hit.clone());
    };
    gl.domElement.addEventListener('pointermove', mv);
    return () => gl.domElement.removeEventListener('pointermove', mv);
  }, [camera, gl]);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += 0.8;
  const pts = new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(24);
  return <Line points={pts} color="#16a34a" lineWidth={3} dashed dashSize={0.18} gapSize={0.1} />;
}

/** Uno 的指示燈跟著模擬狀態變化（只在數值改變時重繪） */
function BenchUno({ children, pinVisual, onPinOver, onPinClick }: { children?: React.ReactNode; pinVisual: (p: PinDef) => { color?: string; opacity?: number; pulse?: boolean } | undefined; onPinOver: (p: PinDef | null) => void; onPinClick: (p: PinDef) => void }) {
  const [lights, setLights] = useState<Lights>({ ON: 1 });
  const last = useRef('');
  useFrame(() => {
    const l = { ON: 1, L: simVisual.L > 0.5 ? 1 : 0, TX: simVisual.TX > 0.3 ? 1 : 0, RX: simVisual.RX > 0.3 ? 1 : 0 };
    const k = `${l.L}${l.TX}${l.RX}`;
    if (k !== last.current) {
      last.current = k;
      setLights(l);
    }
  });
  return (
    <group position={UNO_POS}>
      <UnoModel lights={lights} pins pinVisual={pinVisual} onPinOver={onPinOver} onPinClick={onPinClick}>{children}</UnoModel>
    </group>
  );
}

/** 開發模式：讓自動化測試能把 3D 座標換算成螢幕座標 */
function DevExpose() {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, {
      __benchProject: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      },
      __benchEp: (e: string) => {
        const comps = useBench.getState().comps;
        const p = epPos(e, comps);
        return p ? [p.x, p.y, p.z] : null;
      },
    });
  }, [camera, gl]);
  return null;
}

export function BenchScene() {
  const { comps, wires, pending, selected, running, issues, clickPin, removeWire, select, moveComp, removeComp, setPressed } = useBench();
  const [hoverEp, setHoverEp] = useState<Endpoint | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dz: number; moved: boolean } | null>(null);

  const errEps = useMemo(() => new Set(issues.filter((i) => i.level === 'error').flatMap((i) => i.endpoints)), [issues]);
  const warnEps = useMemo(() => new Set(issues.filter((i) => i.level === 'warn').flatMap((i) => i.endpoints)), [issues]);

  const pinVisual = (p: PinDef) => {
    const e = `uno:${p.id}`;
    if (errEps.has(e)) return { color: '#ff2040', opacity: 0.5, pulse: true };
    if (pending === e) return { color: '#16a34a', opacity: 0.7, pulse: true };
    if (warnEps.has(e)) return { color: '#f59e0b', opacity: 0.5, pulse: true };
    return { color: PIN_COLORS[p.kind], opacity: 0.35 };
  };

  const hoverPos = hoverEp ? epPos(hoverEp, comps) : null;
  const hoverInfo = hoverEp ? epLabel(hoverEp, comps) : null;
  const pendingPos = pending ? epPos(pending, comps) : null;
  const selComp = comps.find((c) => c.id === selected);

  return (
    <>
      <DevExpose />
      <BenchUno
        pinVisual={pinVisual}
        onPinOver={(p) => setHoverEp(p ? `uno:${p.id}` : null)}
        onPinClick={(p) => clickPin(`uno:${p.id}`)}
      />

      {comps.map((c) => {
        const spec = CATALOG[c.type];
        return (
          <group key={c.id}>
            <group
              position={[c.x, 0, c.z]}
              onPointerDown={(e) => {
                e.stopPropagation();
                const press = (e.object.userData as { press?: string }).press;
                if (press) {
                  setPressed(press, true);
                  const up = () => { setPressed(press, false); window.removeEventListener('pointerup', up); };
                  window.addEventListener('pointerup', up);
                  return;
                }
                select(c.id);
                if (!running && e.point) setDrag({ id: c.id, dx: c.x - e.point.x, dz: c.z - e.point.z, moved: false });
              }}
              onPointerOver={() => { document.body.style.cursor = running ? 'default' : 'grab'; }}
              onPointerOut={() => { document.body.style.cursor = ''; }}
            >
              <CompBody c={c} />
              {selected === c.id && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                  <planeGeometry args={[spec.w + 0.25, spec.d + 0.25]} />
                  <meshBasicMaterial color="#0ea5e9" transparent opacity={0.22} toneMapped={false} />
                </mesh>
              )}
            </group>
            {spec.pins.map((p) => {
              const e = `${c.id}:${p.id}`;
              const pos = new THREE.Vector3(c.x + p.dx, PIN_TOP, c.z + p.dz);
              return (
                <Terminal
                  key={e}
                  e={e}
                  pos={pos}
                  color={p.color ?? '#d9a944'}
                  state={errEps.has(e) ? 'error' : pending === e ? 'pending' : 'none'}
                  onOver={setHoverEp}
                  onClick={clickPin}
                />
              );
            })}
          </group>
        );
      })}

      {wires.map((w) => {
        const a = epPos(w.a, comps);
        const b = epPos(w.b, comps);
        if (!a || !b) return null;
        return <WireMesh key={w.id} id={w.id} a={a} b={b} color={w.color} onRemove={removeWire} danger={errEps.has(w.a) && errEps.has(w.b)} />;
      })}

      {pendingPos && !running && <PendingWire from={pendingPos} />}

      {hoverPos && hoverInfo && (
        <Html position={[hoverPos.x, hoverPos.y + 0.2, hoverPos.z]} zIndexRange={[1, 0]}>
          <div className="pin-tip">
            <b>{hoverInfo.title}</b>
            <span>{pending && pending !== hoverEp ? '點一下：把線接到這裡' : hoverInfo.sub}</span>
          </div>
        </Html>
      )}

      {selComp && !running && !drag && (
        <Html position={[selComp.x, 1.6, selComp.z - CATALOG[selComp.type].d / 2]} center zIndexRange={[2, 0]}>
          <button className="btn sm danger" onClick={() => removeComp(selComp.id)} style={{ whiteSpace: 'nowrap' }}>
            <IconTrash size={13} /> 移除{CATALOG[selComp.type].short}
          </button>
        </Html>
      )}

      <DragController
        active={!!drag}
        planeY={0}
        onMove={([x, z]) => {
          if (!drag) return;
          setDrag({ ...drag, moved: true });
          moveComp(drag.id, x + drag.dx, z + drag.dz);
        }}
        onEnd={() => setDrag(null)}
      />
    </>
  );
}
