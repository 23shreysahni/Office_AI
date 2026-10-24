import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reviewData, reviewFiles } from './data.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
export function createReviewApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    const host = req.get('host');
    const port = req.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return res.status(403).json({ error: 'local_review_only' });
    // Permit a user to follow the review link from another site. API/asset reads
    // still require the local origin; embedded cross-site documents stay denied.
    const topLevelEntry = req.path === '/' && req.method === 'GET' && req.get('sec-fetch-mode') === 'navigate' && req.get('sec-fetch-dest') === 'document';
    if (!topLevelEntry && ((req.get('origin') && req.get('origin') !== `http://${host}`) || ['cross-site', 'same-site'].includes(req.get('sec-fetch-site')))) return res.status(403).json({ error: 'origin_denied' });
    if (!['GET', 'HEAD'].includes(req.method)) return res.set('Allow', 'GET, HEAD').status(405).json({ error: 'read_only' });
    next();
  });
  app.get('/api/review', (_req, res) => res.json(reviewData()));
  app.get('/review-files/:key', (req, res) => {
    const text = reviewFiles.get(req.params.key);
    if (!text) return res.status(404).json({ error: 'not_found' });
    res.type('text/plain').send(text);
  });
  const assets = new Map([['/', 'index.html'], ['/app.js', 'app.js'], ['/styles.css', 'styles.css']]);
  for (const [url, file] of assets) app.get(url, (_req, res) => res.sendFile(path.join(publicRoot, file)));
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((_error, _req, res, _next) => res.status(500).json({ error: 'review_unavailable' }));
  return app;
}

export function startReview(port = 4173) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a review port between 1024 and 65535');
  const server = createReviewApp().listen(port, '127.0.0.1', () => console.log(`Local read-only review: http://127.0.0.1:${port}`));
  server.on('error', () => { console.error('Review server unavailable; check whether the loopback port is already in use.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { startReview(); } catch { console.error('Review startup failed.'); process.exitCode = 1; }
}
