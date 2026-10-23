import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
