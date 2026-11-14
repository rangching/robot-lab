import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相對路徑，GitHub Pages 子路徑與本機都能直接用
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5199 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: { environment: 'node' },
} as any);
