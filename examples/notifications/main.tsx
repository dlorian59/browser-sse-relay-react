import { Activity, StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SseRelayProvider, SseConnectionStatus, useSseRelay } from '@59alex/browser-sse-relay-react';
import type { RelayContext, RelayEvent } from '@59alex/browser-sse-relay';
import './style.css';

type Notice = { key: string; text: string };
function App() {
  const [account, setAccount] = useState<string | null>('alice');
  const [items, setItems] = useState<Notice[]>([]);
  const [renders, setRenders] = useState(0);
  const transport = useMemo(() => ({ headers: () => ({ Authorization: `Bearer demo-${account}` }), retry: { minDelayMs: 100, maxDelayMs: 300, maxAttempts: 8 } }), [account]);
  const onEvent = useCallback((event: RelayEvent, context: RelayContext) => {
    const value: unknown = JSON.parse(event.data);
    if (!value || typeof value !== 'object' || !('key' in value) || !('text' in value) || typeof value.key !== 'string' || typeof value.text !== 'string') throw new Error('Invalid notification');
    if (!context.isCurrent()) return;
    // Upsert by business identity makes a repeated delivery harmless to this view.
    // Upsert по бизнес-идентификатору делает повторную доставку безопасной для этого представления.
    const notice = value as Notice;
    setItems(previous => context.isCurrent() ? [...previous.filter(item => item.key !== notice.key), notice] : previous);
  }, []);
  return <SseRelayProvider scope={account ? { accountId: account, streamId: 'notifications' } : null} url="/api/events" onEvent={onEvent} transport={transport}>
    <main><p className="eyebrow">browser-sse-relay-react · practical example</p><h1>Order notifications</h1>
      <p>Disconnect, exhaust retained history, then recover the complete dashboard snapshot.</p>
      <Dashboard account={account} items={items} setItems={setItems} setAccount={setAccount} />
      <button onClick={() => setRenders(value => value + 1)}>Unrelated render ({renders})</button>
    </main>
  </SseRelayProvider>;
}
function Dashboard({ account, items, setItems, setAccount }: { account: string | null; items: Notice[]; setItems: (value: Notice[]) => void; setAccount: (value: string | null) => void }) {
  const relay = useSseRelay(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  // Invalidate pending snapshot responses when identity changes or the view unmounts.
  // При смене аккаунта или размонтировании отклоняем запоздалые ответы со снимком.
  useEffect(() => () => { generation.current++; }, [account]);
  const api = async (path: string, method = 'POST') => {
    const response = await fetch(`/api/${path}`, { method, headers: { Authorization: `Bearer demo-${account}` } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json();
  };
  const action = async (work: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await work(); } catch (failure) { setError(String(failure)); } finally { setBusy(false); } };
  const recover = async () => {
    const current = ++generation.current; await relay.stop();
    const snapshot = await api('snapshot', 'GET');
    if (current !== generation.current || snapshot.scope.accountId !== account || snapshot.scope.streamId !== 'notifications') return;
    // Application state must be installed before its matching cursor is passed to resume().
    // Состояние приложения нужно установить до передачи соответствующего курсора в resume().
    if (!Array.isArray(snapshot.items) || typeof snapshot.cursor !== 'string' || snapshot.items.some((item: unknown) => !item || typeof item !== 'object' || !('key' in item) || !('text' in item) || typeof item.key !== 'string' || typeof item.text !== 'string')) throw new Error('Invalid snapshot');
    setItems(snapshot.items); relay.resume(snapshot.cursor);
  };
  return <>
    <SseConnectionStatus className="connection" />
    <p>Account: <strong data-testid="account">{account ?? 'signed out'}</strong> · <span data-testid="count">{items.length}</span> notices</p>
    <div className="actions">
      <button disabled={busy || !account} onClick={() => void action(async () => { await api('publish'); })}>Publish notification</button>
      <button disabled={busy || !account} onClick={() => void action(async () => { await api('drop'); })}>Disconnect</button>
      <button disabled={busy || !account} onClick={() => void action(async () => { await relay.stop(); await api('expire'); relay.reconnect(); })}>Create retention gap</button>
      <button disabled={busy || !account} onClick={() => void action(recover)}>Restore snapshot</button>
      <button disabled={busy} onClick={() => void action(async () => { generation.current++; await relay.logout(); setItems([]); setAccount(account === 'alice' ? 'bob' : 'alice'); })}>Switch account</button>
      <button disabled={busy || !account} onClick={() => void action(async () => { generation.current++; await relay.logout(); setItems([]); setAccount(null); })}>Logout</button>
    </div>
    {relay.state === 'resync' && <p>History has expired. Restore a snapshot to recover missing notifications.</p>}
    {error && <p role="alert">{error}</p>}
    <ul>{items.map(item => <li key={item.key}>{item.text}</li>)}</ul>
    <small>Cursor: <code data-testid="cursor">{relay.cursor ?? 'none'}</code>. Memory-only state and checkpoints share this provider's lifetime.</small>
  </>;
}
// React 19.2+: preserve view state and the provider together while effects release the transport.
// React 19.2+: сохраняем представление и provider вместе, пока очистка эффектов освобождает transport.
function ActivityExample() {
  const [visible, setVisible] = useState(true);
  return <>
    <div className="activity-controls"><button onClick={() => setVisible(value => !value)}>
      {visible ? 'Hide dashboard' : 'Show dashboard'}
    </button><small>React 19.2+ Activity: hidden view keeps state, closes its connection.</small></div>
    <Activity mode={visible ? 'visible' : 'hidden'}><App /></Activity>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><ActivityExample /></StrictMode>);
