// @ts-nocheck
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type ViteDevServer } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function serveRepoAudio() {
  const types: Record<string, string> = {
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };
  const middleware = (req: Connect.IncomingMessage, res, next) => {
    const url = req.url?.split('?')[0] || '';
    if (!url.startsWith('/assets/audio/')) return next();
    const file = join(repoRoot, url);
    if (!existsSync(file)) return next();
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'serve-repo-audio',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: ViteDevServer) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../dist/campaign', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
  },
  plugins: [serveRepoAudio()],
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
