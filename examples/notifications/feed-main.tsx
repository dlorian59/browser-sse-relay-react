import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OrderNotifications } from '../orders/OrderNotifications.js';
import { loginDemo, demoRequest } from './auth.js';
import type { DemoIdentity } from './auth.js';
import './style.css';

function App() {
  const [account, setAccount] = useState('alice');
  const [identity, setIdentity] = useState<DemoIdentity | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setIdentity(null); setError('');
    void loginDemo(account, location.origin, controller.signal).then(setIdentity).catch(error => {
      if (!controller.signal.aborted) setError(String(error));
    });
    return () => controller.abort();
  }, [account]);
  const session = useMemo(() => identity?.accountId === account ? {
    accountId: account, keyPair: identity.keyPair,
    getAccessToken: (signal: AbortSignal) => { signal.throwIfAborted(); return identity.accessToken; },
  } : null, [identity, account]);
  async function action(path: string) {
    if (!identity || busy) return;
    setBusy(true); setError('');
    try { await demoRequest(identity, path); } catch (error) { setError(String(error)); }
    finally { setBusy(false); }
  }
  return <main>
    <p className="eyebrow">Ready component · browser-sse-relay-react</p>
    <h1>Order activity</h1>
    <p>A working feed with connection status, pause and snapshot recovery. Account: <strong>{account}</strong>.</p>
    <div className="actions">
      <button disabled={!session || busy} onClick={() => void action('publish')}>Publish order update</button>
      <button disabled={!session || busy} onClick={() => void action('drop')}>Disconnect network</button>
      <button disabled={!session || busy} onClick={() => void action('expire')}>Expire history while paused</button>
      <button disabled={busy} onClick={() => setAccount(account === 'alice' ? 'bob' : 'alice')}>Switch account</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {session ? <OrderNotifications session={session} origin={location.origin} /> : <p role="status">Opening session…</p>}
    <p>Local synthetic login; production uses your existing OAuth session.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
