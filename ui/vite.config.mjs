import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Relative paths so Electron can load the pages straight from disk.
  base: './',
  server: { host: '127.0.0.1' },
  build: {
    rollupOptions: {
      // Two screens: the head unit and the instrument cluster.
      input: { main: page('index.html'), cluster: page('cluster.html') },
    },
  },
});
