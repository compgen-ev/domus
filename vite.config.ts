import { defineConfig } from 'vite';
import { createReadStream } from 'fs';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  base: '/map/',
  build: {
    outDir: 'dist/map',
  },
  server: {
    port: 5173,
  },
  plugins: [
    Icons({
      compiler: 'raw',
      autoInstall: false,
    }),
    {
      name: 'landing-page',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            createReadStream('landing/index.html').pipe(res);
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            createReadStream('dist/index.html').pipe(res);
            return;
          }
          next();
        });
      },
    },
  ],
});
