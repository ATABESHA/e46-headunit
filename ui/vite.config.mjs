import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so Electron can load dist/index.html straight from disk.
  base: './',
  server: { host: '127.0.0.1' },
});
