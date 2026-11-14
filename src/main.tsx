import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { useBench } from './features/bench/benchStore';
import { useProgress } from './features/progress/store';
import { useLab } from './lib/labStore';

// 開發模式下把狀態掛到 window，方便除錯與自動化測試
if (import.meta.env.DEV) Object.assign(window, { __lab: { useBench, useProgress, useLab } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
