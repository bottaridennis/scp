import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import { buildContent } from './scripts/build-content.ts';

/** Rebuilds the encrypted archive whenever a file in content/ changes (dev only). */
function contentWatcher(): Plugin {
  return {
    name: 'content-watcher',
    apply: 'serve',
    configureServer(server) {
      const dir = path.resolve(__dirname, 'content');
      server.watcher.add(dir);
      let timer: ReturnType<typeof setTimeout> | undefined;
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(dir)) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            await buildContent({ quiet: true });
            server.ws.send({ type: 'full-reload' });
          } catch (err) {
            server.config.logger.error(`[content] ${(err as Error).message}`);
          }
        }, 150);
      });
    },
  };
}

// GitHub Pages serves project sites under a sub-path (e.g. /scp/terminale/).
// Override with BASE_PATH=/nome-repo/ when deploying elsewhere.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : (process.env.BASE_PATH ?? '/scp/terminale/'),
  plugins: [contentWatcher()],
  // The SCP archive reuses the main site's API module (../src/services/scpApi.ts).
  resolve: { dedupe: ['dompurify'] },
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/scp-api': {
        target: 'https://scp-data.tedivm.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/scp-api/, ''),
      },
    },
  },
  build: { target: 'es2022' },
}));
