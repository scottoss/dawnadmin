/**
 * Full-stack server entry point for DawnChat Admin Console
 * Combines Express API (MongoDB platform bans, reports, audit logs & CORS proxy) + Vite middleware
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import {
  handleMongoStatus,
  handleMongoConfig,
  handlePlatformBans,
  handlePlatformUnban,
  handleMongoUsers,
  handleUserEditIdentity,
  handleUserDeleteAvatar,
  handleUserBadges,
  handleUserImpersonate,
  handlePlatformReports,
  handleSafetyStrikes,
  handlePlatformAuditLogs,
  handleMongoServers,
  handleMongoBots,
  handleMongoCommunication
} from './server/routes.ts';
import { getOrInitBotClient } from './server/botClient.ts';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  // JSON parser for admin API routes
  app.use(express.json());

  // Direct MongoDB API endpoints
  app.get('/api/mongo/status', handleMongoStatus);
  app.all('/api/mongo/config', handleMongoConfig);
  app.all('/api/mongo/bans', handlePlatformBans);
  app.all('/api/mongo/unban', handlePlatformUnban);
  app.all('/api/mongo/users', handleMongoUsers);
  app.all('/api/mongo/user/edit-identity', handleUserEditIdentity);
  app.all('/api/mongo/user/delete-avatar', handleUserDeleteAvatar);
  app.all('/api/mongo/user/badges', handleUserBadges);
  app.all('/api/mongo/user/impersonate', handleUserImpersonate);
  app.all('/api/mongo/reports', handlePlatformReports);
  app.all('/api/mongo/safety/strikes', handleSafetyStrikes);
  app.all('/api/mongo/audit-logs', handlePlatformAuditLogs);
  app.all('/api/mongo/servers*', handleMongoServers);
  app.all('/api/mongo/bots*', handleMongoBots);
  app.all('/api/mongo/communication*', handleMongoCommunication);

  // Direct Autumn & Authum Asset Proxy (attachments, avatars, banners, icons)
  app.get(['/autumn/*', '/authum/*'], async (req, res) => {
    try {
      const cleanPath = req.url.replace(/^\/(?:autumn|authum)/, '');
      const targetUrl = `https://api.dawn-chat.com/autumn${cleanPath}`;

      const fetchResponse = await fetch(targetUrl);
      res.status(fetchResponse.status);
      fetchResponse.headers.forEach((val, key) => {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

      const arrayBuffer = await fetchResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (err: unknown) {
      res.status(502).json({
        error: 'Autumn proxy error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Relay proxy to bypass CORS for api.dawn-chat.com
  app.all('/api/proxy', async (req, res) => {
    try {
      const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
      const targetUrl = urlObj.searchParams.get('target') || req.headers['x-target-url'] as string;

      if (!targetUrl) {
        res.status(400).json({ error: 'Missing target URL parameter' });
        return;
      }

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
        body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : JSON.stringify(req.body),
      });

      res.status(fetchResponse.status);
      fetchResponse.headers.forEach((val, key) => {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await fetchResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (err: unknown) {
      res.status(502).json({
        error: 'Proxy request error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Mount Vite middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`[DawnChat Admin Console] Listening on http://0.0.0.0:${port}`);

    // Auto-login to announcement bot with stoat.js / revolt.js if token is present
    if (process.env.ANNOUNCEMENT_BOT_TOKEN || process.env.BOT_TOKEN) {
      getOrInitBotClient()
        .then((client) => {
          if (client) {
            console.log(`[stoat.js / revolt.js] Announcement bot client initialized`);
          }
        })
        .catch((err) => {
          console.warn('[stoat.js / revolt.js] Initial bot login notice:', err?.message || err);
        });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
