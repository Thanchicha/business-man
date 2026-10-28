import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5183 },
  build: { chunkSizeWarningLimit: 1500 },
});
