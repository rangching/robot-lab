# 機器人實驗室（Robot Lab）

做機器人一定會碰到的 8 塊開發板：3D 拆解、接線工作台、引導任務、找零件測驗、拆裝組裝，加上原創的專注背景音樂。
線上版：https://rangching.github.io/robot-lab/

目前開放 **Uno** 與 **Nano**（全功能：3D 拆解、找零件測驗、拆裝組裝、工作台任務、課程）。其他板子只有比較表資料，顯示「即將推出」。每塊板子的學習進度分開記錄。

## 開發

```bash
npm install
npm run dev        # http://localhost:5199
npm test           # 電路檢查、測驗計分、等級的單元測試
npm run build      # 輸出到 dist/（相對路徑，可直接放到 GitHub Pages）
```

背景音樂與音效是用程式合成的，重新產生的方法見 `tools/music/README.md`。

## 結構

| 路徑 | 內容 |
|---|---|
| `src/data/boards/registry.ts` | **板子登錄表**：`BoardData`（尺寸、腳位、零件外框、組裝托盤、3D 視角、工作台位置） |
| `src/data/boards/uno.ts`、`nano.ts` | 各板的規格、零件、腳位座標、課程文字、測驗題 |
| `src/data/boards/index.ts` | 8 塊板子的比較表 |
| `src/three/boards/visuals.tsx` | **3D 外觀登錄表**：`BoardVisual`（零件幾何、腳位熱點歸屬、PCB 貼圖、工作台額外物件） |
| `src/three/boards/BoardModel.tsx` | 通用 3D 板子：爆炸圖、高亮、拆裝位移、腳位熱點、背面零件翻轉 |
| `src/three/boards/unoVisual.tsx`、`nanoVisual.tsx` | 各板的零件幾何（Nano 另含工作台用的麵包板） |
| `src/features/viewer/` | 3D 舞台：檢視／找零件測驗／拆裝組裝 |
| `src/features/bench/` | 工作台、各板的引導任務（`missions.ts` 的 `MISSIONS_BY_BOARD`）、元件模型 |
| `src/sim/` | 接線節點、上電前檢查、電路求值、程式行為模擬；`sim/board.ts` 記錄工作台上目前是哪塊板子 |
| `src/features/progress/` | XP、等級、徽章、連續天數、每塊板子的進度（localStorage，v1 存檔會自動搬到 `boards.uno`） |
| `src/features/music/` | Web Audio 無縫循環播放器、音效 |

## 擴充其他板子

1. `src/data/boards/<板子>.ts`：匯出符合 `BoardData` 的資料（照 `nano.ts`），在 `registry.ts` 的 `BOARD_DATA` 加一行。
2. `src/three/boards/<板子>Visual.tsx`：匯出 `BoardVisual`，在 `visuals.tsx` 的 `BOARD_VISUALS` 加一行。背面零件在資料裡標 `side: 'bottom'`，照正面方向畫就好。
3. （選擇性）專屬任務放進 `missions.ts` 的 `MISSIONS_BY_BOARD`；端點前綴一律是 `mcu:`，例如 `mcu:D9`。
4. `badges.ts` 加上 `<板子 id>-master` 徽章，完成度 100% 時會自動頒發。
5. `src/data/boards/index.ts` 把 `locked` 改成 `false`。`npm test` 會檢查每塊板子的零件、題目、外框與腳位是否一致。
