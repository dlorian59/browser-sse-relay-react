import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { MemoryEventStore, createNodeRelay } from '@59alex/browser-sse-relay/server';

// Notifications and retained history share one synchronous commit boundary in this demo.
// Уведомления и история имеют одну синхронную границу сохранения в этом демо.
export async function startDemo(port = 0) {
  const store = new MemoryEventStore({ maxEventsPerStream: 3 });
  const data = new Map(); let connections = 0;
  const account = request => { const value = request.headers.authorization; return value === 'Bearer demo-alice' ? 'alice' : value === 'Bearer demo-bob' ? 'bob' : undefined; };
  const scope = identity => ({ accountId: identity, streamId: 'notifications' });
  const relay = createNodeRelay({ store, authenticate: account, stream: () => 'notifications', heartbeatMs: 100 });
  const vite = await createViteServer({ configFile: false, root: fileURLToPath(new URL('.', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'spa' });
  const json = (response, value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) { vite.middlewares(request, response); return; }
    const identity = account(request);
    if (!identity) { json(response, { error: 'unauthorized' }, 401); return; }
    // Fixed demo bearer values are not production authentication; do not expose this loopback server.
    // Фиксированные demo-токены не являются рабочей авторизацией; сервер должен оставаться на loopback.
    if (path === '/api/events' && request.method === 'GET') { connections++; void relay(request, response); return; }
    if (path === '/api/snapshot') {
      json(response, { scope: scope(identity), items: data.get(identity) ?? [], cursor: store.currentCursor(scope(identity)) }); return;
    }
    if (path === '/api/stats') { json(response, { connections, subscribers: store.stats().subscribers }); return; }
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
  });
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}`, async close() {
    store.disconnect(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await vite.close();
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startDemo(Number(process.env.PORT ?? 4189)); console.log(`Notifications demo: ${demo.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await demo.close(); process.exit(0); });
}
