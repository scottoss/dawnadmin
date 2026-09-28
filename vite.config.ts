import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function apiProxyPlugin(): Plugin {
  return {
    name: 'dawnchat-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
          const targetUrl = urlObj.searchParams.get('target') || req.headers['x-target-url'] as string;

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing target URL parameter' }));
            return;
          }

          // Buffer request body if present
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

          // Forward specific headers
          const forwardHeaders: Record<string, string> = {};
          if (req.headers['x-session-token']) forwardHeaders['x-session-token'] = req.headers['x-session-token'] as string;
          if (req.headers['x-mfa-ticket']) forwardHeaders['x-mfa-ticket'] = req.headers['x-mfa-ticket'] as string;
          if (req.headers['x-audit-log-reason']) forwardHeaders['x-audit-log-reason'] = req.headers['x-audit-log-reason'] as string;
          if (req.headers['idempotency-key']) forwardHeaders['idempotency-key'] = req.headers['idempotency-key'] as string;
          if (req.headers['content-type']) forwardHeaders['content-type'] = req.headers['content-type'] as string;
          forwardHeaders['accept'] = 'application/json, text/plain, */*';

          const fetchResponse = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: forwardHeaders,
            body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : bodyBuffer,
          });

          res.statusCode = fetchResponse.status;
          fetchResponse.headers.forEach((val, key) => {
            // Filter out encoding headers that might cause decompression mismatches
            if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
              res.setHeader(key, val);
            }
          });
          // Ensure CORS headers for browser
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

          const responseArrayBuffer = await fetchResponse.arrayBuffer();
          res.end(Buffer.from(responseArrayBuffer));
        } catch (err: unknown) {
          console.error('Proxy request failed:', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Proxy request error',
            message: err instanceof Error ? err.message : String(err)
          }));
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

