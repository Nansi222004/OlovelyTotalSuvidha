import type { Plugin } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

export function serveAssetsPlugin(): Plugin {
  return {
    name: 'serve-assets',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Only handle /assets/* requests
        const url = req.url;
        if (url?.startsWith('/assets/')) {
          const assetPath = url.replace('/assets/', '');
          const assetsDir = resolve(__dirname, 'assets');
          const fullPath = join(assetsDir, assetPath);

          // Security: prevent directory traversal
          if (!fullPath.startsWith(assetsDir)) {
            return next();
          }

          if (existsSync(fullPath)) {
            const ext = extname(fullPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
              '.mp4': 'video/mp4',
              '.webm': 'video/webm',
            };

            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            
            const file = readFileSync(fullPath);
            res.end(file);
            return;
          }
        }
        next();
      });
    },
  };
}

