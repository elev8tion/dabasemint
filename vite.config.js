import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 4174,
  },
  build: {
    outDir: 'dist',
  },
});
