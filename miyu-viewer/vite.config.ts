import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5185 },
  build: { chunkSizeWarningLimit: 1500 },
});
