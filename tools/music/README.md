# 背景音樂與音效產生器

`compose.mjs` 是純 Node.js 撰寫的離線合成器（不需任何 npm 套件），所有音樂與音效都由程式即時合成，並使用固定種子的亂數產生器，每次輸出結果都相同。

## 重新產生

```bash
node tools/music/compose.mjs                 # 產生全部曲目與音效並驗證響度
node tools/music/compose.mjs --only focus    # 只產生指定項目（focus,debug,sprint,sfx）
node tools/music/compose.mjs --no-verify     # 略過 ffmpeg 驗證
```

需求：Node 18 以上、`ffmpeg`／`ffprobe`（含 libmp3lame）。程式會依序尋找環境變數 `FFMPEG`、`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`。全部重新產生約 30 秒。

## 輸出

| 檔案 | 內容 |
| --- | --- |
| `public/audio/focus.mp3` | 專注模式：Lo-fi hip-hop，78 BPM，FM 電鋼琴爵士和弦、搖擺鼓組、黑膠雜訊與磁帶抖動 |
| `public/audio/debug.mp3` | 深度除錯：氛圍電子，無鼓，緩慢演變的 pad、像資料閃爍的濾波琶音、低頻持續音 |
| `public/audio/sprint.mp3` | 衝刺建構：Synthwave，100 BPM，八度琶音貝斯、門控 pad、四拍大鼓，主旋律僅少量出現 |
| `public/audio/sfx/*.mp3` | snap、solder、correct、wrong、levelup、alarm、click、wire、power、badge |
| `public/audio/tracks.json` | 曲目清單（路徑不含開頭斜線） |
| `tools/music/out/` | 暫存 WAV（已列入 `.gitignore`） |

## 設計重點

- **無縫循環**：每個事件都會在「本輪」與「前一輪」各放一次，再擷取剛好一輪，因此殘響、延遲與釋放尾音會自然接回開頭；所有 LFO 與雜訊皆以整輪為週期。曲長皆為整數小節（64 或 80 小節）。
- **響度**：曲目約 −18 LUFS、音效約 −16 LUFS，峰值 ≤ −1 dBTP。程式會量測編碼後的 MP3 再微調一次增益。`click`、`snap` 這類極短暫態音受峰值限制，實際響度較低（約 −23 LUFS）。
- **網頁播放建議**：要完全無縫循環，請用 Web Audio API（`AudioBufferSourceNode.loop = true`）；`<audio loop>` 在部分瀏覽器接縫處可能有極短空隙。
