import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createDpopFetch } from '@59alex/browser-sse-relay';
import type { RelayOptions, StreamScope } from '@59alex/browser-sse-relay';
import { SseRelayProvider, SseConnectionStatus, useSseRelay } from '@59alex/browser-sse-relay-react';

// Keep this provider and the business state for the same lifetime; the host validates and applies events.
// Provider и бизнес-состояние живут одинаково; проверку и применение событий выполняет приложение.
export function NotificationScope({ scope, keyPair, getAccessToken, origin, refreshAuth, onEvent, children }: {
  scope: StreamScope | null; keyPair: CryptoKeyPair; origin: string;
  getAccessToken: (signal: AbortSignal) => string | Promise<string>;
  refreshAuth?: RelayOptions['refreshAuth'];
  onEvent: RelayOptions['onEvent']; children: ReactNode;
}) {
  // OAuth owns this bound token/key; every GET/reconnect receives a fresh proof, never a fixed header.
  // OAuth владеет связанными token/key; каждый GET/reconnect получает новый proof, не постоянный header.
  const transport = useMemo(() => ({ fetch: createDpopFetch({ keyPair, getAccessToken, origin }),
    ...(refreshAuth ? { refreshAuth } : {}) }), [keyPair, getAccessToken, origin, refreshAuth]);
  return <SseRelayProvider scope={scope} url="/api/events" transport={transport} onEvent={onEvent}>
    {children}
  </SseRelayProvider>;
}

// Mount beneath NotificationScope. These labels do not alter the transport state machine.
// Разместите под NotificationScope. Подписи не меняют состояния transport.
export function ConnectionLabel() {
  return <SseConnectionStatus className="connection" labels={{
    connecting: 'Connecting…', live: 'Notifications up to date',
    waiting: 'Connection interrupted; retrying…', resync: 'Restore a snapshot to continue',
  }} />;
}

// Logout clears a checkpoint; the host also clears its view and performs its own authentication logout.
// Logout очищает checkpoint; приложение также очищает представление и завершает свою auth-сессию.
export function ReconnectControls({ onSignedOut }: { onSignedOut: () => void }) {
  const relay = useSseRelay();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(String(failure)); } finally { setBusy(false); }
  };
  return <>
    <p>{relay.state} · attempt {relay.attempt} · cursor {relay.cursor ?? 'none'}</p>
    <button disabled={busy || relay.pending} onClick={() => void run(() => relay.stop())}>Pause</button>
    <button disabled={busy || relay.pending || relay.state === 'resync'} onClick={() => relay.reconnect()}>Reconnect</button>
    <button disabled={busy || relay.pending} onClick={() => void run(async () => { await relay.logout(); onSignedOut(); })}>Sign out</button>
    {error && <p role="alert">{error}</p>}
  </>;
}
