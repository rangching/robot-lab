# 機器人實驗室（Robot Lab）

做機器人一定會碰到的 8 塊開發板：3D 拆解、接線工作台、引導任務、找零件測驗、拆裝組裝，加上原創的專注背景音樂。
線上版：https://rangching.github.io/robot-lab/

目前是 **Uno 全功能試做版**，另外 7 塊板子只有比較表資料，顯示「即將解鎖」。

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
| `src/data/boards/uno.ts` | Uno 的規格、15 個零件、腳位座標、課程文字、測驗題 |
| `src/data/boards/index.ts` | 8 塊板子的比較表 |
| `src/three/boards/UnoModel.tsx` | 程序化 3D 模型（每個零件一個 group，可爆炸、可拆裝） |
| `src/features/viewer/` | 3D 舞台：檢視／找零件測驗／拆裝組裝 |
| `src/features/bench/` | 工作台、6 個引導任務、元件模型 |
| `src/sim/` | 接線節點（netlist）、上電前檢查規則、電路求值、程式行為模擬 |
| `src/features/progress/` | XP、等級、徽章、連續天數（存在瀏覽器 localStorage） |
| `src/features/music/` | Web Audio 無縫循環播放器、音效 |

## 擴充其他板子

1. 在 `src/data/boards/` 新增板子資料（照 `uno.ts` 的 `BoardLesson` 格式）。
2. 在 `src/three/boards/` 做它的 3D 模型，零件 id 與資料一致。
3. 在 `src/data/boards/index.ts` 把 `locked` 改成 `false`。
