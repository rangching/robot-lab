import type { FC, ReactNode } from 'react';
import type * as THREE from 'three';
import type { BoardId, PinDef } from '../../data/types';

/** 板上指示燈亮度（0–1） */
export interface Lights { L?: number; TX?: number; RX?: number; ON?: number }

/** 一塊板子的 3D 外觀。資料（尺寸、腳位、零件位置）在 src/data/boards/registry.ts */
export interface BoardVisual {
  id: BoardId;
  pcbT: number;
  edgeColor: string;
  /** 每個零件的幾何；原點在零件 at 的 xz、y = 0（PCB 頂面）。背面零件照正面畫，BoardModel 會翻轉 */
  renderPart: (id: string, lights: Lights) => ReactNode;
  /** 這支腳的熱點掛在哪個零件上 */
  headerOf: (p: PinDef) => string;
  makeTop: () => THREE.CanvasTexture;
  makeBottom: () => THREE.CanvasTexture;
  /** 工作台上的額外物件（Nano 的麵包板），座標相對工作台上的板子位置 */
  BenchExtras?: FC;
}
