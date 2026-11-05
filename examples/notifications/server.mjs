import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createDemoDpopAuth, DemoDpopError } from './dpop-auth.mjs';
import { MemoryEventStore, createNodeRelay } from '@59alex/browser-sse-relay/server';

// Notifications and retained history share one synchronous commit boundary in this demo.
// Уведомления и история имеют одну синхронную границу сохранения в этом демо.
export async function startDemo(port = 0) {
  const store = new MemoryEventStore({ maxEventsPerStream: 3 });
  const data = new Map(); let connections = 0;
  const auth = createDemoDpopAuth(); const authenticated = new WeakMap();
  let trustedOrigin = ''; let verifiedRequests = 0, nonceChallenges = 0;
  const account = request => authenticated.get(request)?.accountId;
  const scope = identity => ({ accountId: identity, streamId: 'notifications' });
  const relay = createNodeRelay({ store, authenticate: account, stream: () => 'notifications', heartbeatMs: 100 });
  const vite = await createViteServer({ configFile: false, root: fileURLToPath(new URL('.', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'spa' });
  const json = (response, value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  const server = createServer((request, response) => { void handle(request, response); });
  async function handle(request, response) {
    try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) { vite.middlewares(request, response); return; }
    if (!request.url.startsWith('/')) throw new DemoDpopError('invalid_request_target', 400);
    const target = new URL(request.url, trustedOrigin);
    if (target.origin !== trustedOrigin) throw new DemoDpopError('invalid_request_target', 400);
    if (path === '/api/login' && request.method === 'POST') {
      // Local fixture only: account selection is not an OAuth login or production identity verification.
      // Только local fixture: выбор аккаунта не заменяет OAuth login и production-проверку личности.
      let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 4096) throw new DemoDpopError('login_too_large', 400); }
      const input = JSON.parse(body);
      if (!['alice', 'bob'].includes(input.accountId)) throw new DemoDpopError('invalid_demo_account', 400);
      json(response, auth.issueSession({ accountId: input.accountId, jkt: input.jkt })); return;
    }
    const claims = await auth.verify({ authorization: request.headers.authorization, proof: request.headers.dpop,
      method: request.method, url: target.href });
    authenticated.set(request, claims); verifiedRequests++;
    const identity = claims.accountId;
    if (path === '/api/events' && request.method === 'GET') {
      connections++;
      // Bound the open stream to this synthetic token lifetime as well as verifying each new request.
      // Ограничиваем открытый поток сроком synthetic token, помимо проверки каждого нового запроса.
      const expiry = setTimeout(() => response.destroy(), Math.max(0, claims.expiresAt - Date.now()));
      try { await relay(request, response); } finally { clearTimeout(expiry); }
      return;
    }
    if (path === '/api/snapshot') {
      json(response, { scope: scope(identity), items: data.get(identity) ?? [], cursor: store.currentCursor(scope(identity)) }); return;
    }
    if (path === '/api/stats') { json(response, { connections, subscribers: store.stats().subscribers, verifiedRequests, nonceChallenges }); return; }
    if (request.method !== 'POST') { json(response, { error: 'method not allowed' }, 405); return; }
    if (path === '/api/drop') { store.disconnect(scope(identity)); json(response, { ok: true }); return; }
    if (path === '/api/publish' || path === '/api/expire') {
      const count = path === '/api/expire' ? 6 : 1;
      for (let index = 0; index < count; index++) {
        const previous = data.get(identity) ?? [];
        const item = { key: `${identity}-${previous.length + 1}`, text: `Order ${previous.length + 1} shipped` };
        store.append(scope(identity), JSON.stringify(item), 'notification');
        data.set(identity, [...previous, item]);
      }
      json(response, { count: data.get(identity).length }); return;
    }
    json(response, { error: 'not found' }, 404);
    } catch (error) {
      if (error instanceof DemoDpopError && error.code === 'use_dpop_nonce') nonceChallenges++;
      if (!response.destroyed && !response.headersSent) auth.writeError(response, error);
      else if (!response.destroyed) response.destroy();
    }
  }
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  trustedOrigin = `http://127.0.0.1:${server.address().port}`;
  return { url: trustedOrigin, async close() {
    store.disconnect(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await vite.close();
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startDemo(Number(process.env.PORT ?? 4189)); console.log(`Notifications demo: ${demo.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await demo.close(); process.exit(0); });
}
