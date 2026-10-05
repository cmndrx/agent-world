import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  server: {
    port: 5177,
    proxy: { '/api': 'http://127.0.0.1:4777' },
    fs: { allow: ['..'] },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
