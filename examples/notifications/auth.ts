import { createDpopFetch, createDpopKeyPair, createDpopProof, getDpopThumbprint } from '@59alex/browser-sse-relay';

export interface DemoIdentity {
  accountId: string; keyPair: CryptoKeyPair; accessToken: string; expiresAt: number;
  origin: string; read: typeof fetch; actionNonce?: string;
}
// Synthetic local login binds an opaque token to a fresh key; production uses the application's OAuth flow.
// Локальный синтетический login привязывает токен к новому ключу; production использует OAuth приложения.
export async function loginDemo(accountId: string, origin: string, signal?: AbortSignal): Promise<DemoIdentity> {
  const keyPair = await createDpopKeyPair();
  const jkt = await getDpopThumbprint(keyPair);
  signal?.throwIfAborted();
  const response = await fetch(new URL('/api/login', origin), { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, jkt }),
    ...(signal ? { signal } : {}) });
  if (!response.ok) throw new Error(`Demo login HTTP ${response.status}`);
  const session = await response.json();
  if (typeof session.accessToken !== 'string' || session.tokenType !== 'DPoP' || typeof session.expiresAt !== 'number') throw new Error('Invalid demo login');
  signal?.throwIfAborted();
  const read = createDpopFetch({ keyPair, origin, getAccessToken: current => { current.throwIfAborted(); return session.accessToken; } });
  return { accountId, keyPair, accessToken: session.accessToken, expiresAt: session.expiresAt, origin, read };
}

export async function demoRequest(identity: DemoIdentity, path: string, method = 'POST'): Promise<unknown> {
  if (!['snapshot', 'stats', 'publish', 'drop', 'expire'].includes(path) || !['GET', 'POST'].includes(method)) throw new Error('Unsupported demo operation');
  const url = new URL(`/api/${path}`, identity.origin).href;
  let response: Response;
  if (method === 'GET') response = await identity.read(url);
  else {
    // These fixture POSTs have no body and verify before mutation; retry only their first nonce challenge.
    // Эти POST fixture не имеют body и проверяются до изменения данных; повторяем только первый nonce challenge.
    response = new Response(null, { status: 500 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const proof = await createDpopProof({ keyPair: identity.keyPair, url, method,
        accessToken: identity.accessToken, ...(identity.actionNonce ? { nonce: identity.actionNonce } : {}) });
      response = await fetch(url, { method, redirect: 'error', headers: { Authorization: `DPoP ${identity.accessToken}`, DPoP: proof } });
      const nonce = response.headers.get('DPoP-Nonce');
      if (attempt === 0 && response.status === 401 && response.headers.get('WWW-Authenticate')?.includes('use_dpop_nonce') && nonce) {
        identity.actionNonce = nonce; await response.body?.cancel(); continue;
      }
      break;
    }
  }
  if (!response.ok) throw new Error(`Demo HTTP ${response.status}`);
  return response.json();
}
