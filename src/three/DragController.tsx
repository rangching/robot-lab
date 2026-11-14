import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** 拖曳期間把滑鼠位置投影到 y = planeY 的水平面，回傳 [x, z] */
export function DragController({ active, planeY = 0, onMove, onEnd }: { active: boolean; planeY?: number; onMove: (p: [number, number]) => void; onEnd: (p: [number, number] | null) => void }) {
  const { camera, gl } = useThree();
  const cb = useRef({ onMove, onEnd });
  cb.current = { onMove, onEnd };
  useEffect(() => {
    if (!active) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const rc = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const toPoint = (e: PointerEvent): [number, number] | null => {
      const r = gl.domElement.getBoundingClientRect();
      v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(v, camera);
      return rc.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
    };
    const mv = (e: PointerEvent) => {
      const p = toPoint(e);
      if (p) cb.current.onMove(p);
    };
    const up = (e: PointerEvent) => cb.current.onEnd(toPoint(e));
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
  }, [active, camera, gl, planeY]);
  return null;
}
