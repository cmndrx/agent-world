import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  server: {
    // Override for isolated QA stacks; defaults match `npm run dev`.
    port: Number(process.env.AGENT_WORLD_WEB_PORT || 5177),
    proxy: { '/api': `http://127.0.0.1:${process.env.AGENT_WORLD_PORT || 4777}` },
    fs: { allow: ['..'] },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
