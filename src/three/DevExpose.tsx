import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** 開發模式：把 3D 座標換算成螢幕座標，給自動化測試用 */
export function DevExpose({ name }: { name: string }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, {
      [name]: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      },
    });
  }, [camera, gl, name]);
  return null;
}
