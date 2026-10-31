import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const API = process.env.API_URL ?? 'http://localhost:8787';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [path.resolve('.')] },
    proxy: { '/api': API, '/uploads': API },
  },
});
