import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5184 },
  build: { chunkSizeWarningLimit: 1500 },
});
