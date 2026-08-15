import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '../dist/campaign',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
