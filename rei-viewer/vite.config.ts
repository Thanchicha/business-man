import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5181 },
  build: { chunkSizeWarningLimit: 1500 },
});
