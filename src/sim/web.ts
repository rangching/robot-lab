import { create } from 'zustand';

/**
 * 模擬「手機瀏覽器 ↔ ESP32 網頁伺服器」。
 * 畫面上的手機面板把請求丟進 inbox，ESP32 的程式（generator）每輪 loop 取出一筆來處理。
 */
export interface WebState {
  /** ESP32 連上 Wi-Fi 後拿到的 IP；null 代表還沒連上 */
  ip: string | null;
  inbox: string[];
  /** 程式真的處理過的請求次數 */
  on: number;
  off: number;
  led: boolean;
  connect: (ip: string) => void;
  request: (path: string) => void;
  take: () => string | undefined;
  served: (path: string, led: boolean) => void;
  reset: () => void;
}

export const useWeb = create<WebState>((set, get) => ({
  ip: null,
  inbox: [],
  on: 0,
  off: 0,
  led: false,
  connect: (ip) => set({ ip }),
  request: (path) => {
    if (!get().ip) return;
    set((s) => ({ inbox: [...s.inbox, path].slice(-4) }));
  },
  take: () => {
    const [first, ...rest] = get().inbox;
    if (first !== undefined) set({ inbox: rest });
    return first;
  },
  served: (path, led) => set((s) => ({ led, on: s.on + (path === '/on' ? 1 : 0), off: s.off + (path === '/off' ? 1 : 0) })),
  reset: () => set({ ip: null, inbox: [], on: 0, off: 0, led: false }),
}));
