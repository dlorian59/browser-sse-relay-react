'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { jsonEventHandler, validateCursor } from '@59alex/browser-sse-relay';
import type { RelayOptions, StreamScope } from '@59alex/browser-sse-relay';
import { SseConnectionStatus, SseRelayProvider, useSseRelay } from './index.js';
import type { RelayTransportOptions } from './session.js';
import { FeedStore } from './feed-store.js';
import { readSnapshotJson } from './snapshot.js';

export const FeedDefaults = Object.freeze({ MAX_ITEMS: 100, SNAPSHOT_MAX_BYTES: 1048576, SNAPSHOT_TIMEOUT_MS: 10000 });
export interface SseFeedSnapshot {
  readonly scope: StreamScope;
  readonly cursor: string;
  readonly items: readonly unknown[];
}
export interface SseFeedProps<T> {
  scope: StreamScope | null;
  url: RelayOptions['url'];
  decode(value: unknown): T;
  getKey(item: T): string;
  renderItem(item: T): ReactNode;
  transport?: RelayTransportOptions;
  /** Display window only; this is not a complete retained log or durable business state. */
  maxItems?: number;
  snapshotUrl?: string;
  /** Decoded HTTP body bytes, checked before JSON parsing. Does not bound a custom loader. */
  snapshotMaxBytes?: number;
  /** Entire recovery operation, including custom loaders that cooperate with AbortSignal. */
  snapshotTimeoutMs?: number;
  loadSnapshot?: (context: { scope: StreamScope; signal: AbortSignal }) => Promise<SseFeedSnapshot>;
  title?: string;
  locale?: 'en' | 'ru';
  className?: string;
  style?: CSSProperties;
}
const COPY = {
  en: { title: 'Notifications', empty: 'No updates yet', retry: 'Reconnect', pause: 'Pause', recover: 'Restore updates',
    missing: 'Some updates are no longer available. A matching snapshot is required.', error: 'Could not restore updates. Try again.',
    count: 'Updates', working: 'Working…' },
  ru: { title: 'Уведомления', empty: 'Обновлений пока нет', retry: 'Подключиться', pause: 'Приостановить', recover: 'Восстановить обновления',
    missing: 'Часть обновлений уже недоступна. Нужен согласованный снимок данных.', error: 'Не удалось восстановить обновления. Повторите попытку.',
    count: 'Обновления', working: 'Подождите…' },
};
const RU_STATUS = { idle: 'Нет подключения', connecting: 'Подключаемся', replaying: 'Восстанавливаем события', live: 'Данные актуальны',
  waiting: 'Ожидаем переподключения', authenticating: 'Обновляем авторизацию', resync: 'Нужен снимок данных', failed: 'Соединение остановлено', closed: 'Отключено' };
const button: CSSProperties = { font: 'inherit', minHeight: 44, padding: '8px 16px', borderRadius: 8,
  border: '1px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer' };

/** A bounded, keyed live view with status and recovery controls; owns both view and checkpoint lifetime. */
export function SseFeed<T>(props: SseFeedProps<T>): ReactNode {
  if (props.snapshotUrl !== undefined && props.loadSnapshot !== undefined) {
    throw new TypeError('Choose snapshotUrl or loadSnapshot, not both');
  }
  const maxItems = props.maxItems ?? FeedDefaults.MAX_ITEMS;
  const snapshotMaxBytes = props.snapshotMaxBytes ?? FeedDefaults.SNAPSHOT_MAX_BYTES;
  const snapshotTimeoutMs = props.snapshotTimeoutMs ?? FeedDefaults.SNAPSHOT_TIMEOUT_MS;
  if (!Number.isSafeInteger(snapshotMaxBytes) || snapshotMaxBytes < 1) throw new TypeError('snapshotMaxBytes must be a positive safe integer');
  if (!Number.isSafeInteger(snapshotTimeoutMs) || snapshotTimeoutMs < 1 || snapshotTimeoutMs > 2147483647) {
    throw new TypeError('snapshotTimeoutMs must fit a positive platform timer');
  }
  // Replacing scope discards both view and its private memory checkpoint before showing the next account.
  // Смена области сбрасывает и список, и его личный checkpoint до показа следующего аккаунта.
  const identity = JSON.stringify([props.scope?.accountId, props.scope?.streamId, maxItems]);
  return <FeedSession key={identity} {...props} maxItems={maxItems} />;
}
function FeedSession<T>(props: SseFeedProps<T> & { maxItems: number }): ReactNode {
  const [store] = useState(() => new FeedStore<T>(props.maxItems));
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const onEvent = jsonEventHandler({ decode: props.decode, onData: (item: T) => store.upsert(item, props.getKey) });
  return <SseRelayProvider scope={props.scope} url={props.url} onEvent={onEvent}
    {...(props.transport ? { transport: props.transport } : {})}>
    <FeedView {...props} store={store} items={items} />
  </SseRelayProvider>;
}
function FeedView<T>({ store, items, ...props }: SseFeedProps<T> & { store: FeedStore<T>; items: readonly T[] }): ReactNode {
  const relay = useSseRelay();
  const copy = COPY[props.locale ?? 'en'];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true; setBusy(false);
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);
  async function recover(): Promise<void> {
    if (!props.scope || (!props.loadSnapshot && props.snapshotUrl === undefined) || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setFailed(false);
    let timedOut = false;
    // Bound the entire recovery, including HTTP body consumption and cooperative SDK loaders.
    // Ограничиваем всё восстановление, включая чтение body и загрузчики SDK, учитывающие signal.
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Snapshot recovery timed out'));
    }, props.snapshotTimeoutMs ?? FeedDefaults.SNAPSHOT_TIMEOUT_MS);
    const external = props.transport?.signal;
    const abort = () => controller.abort(external?.reason);
    if (external?.aborted) abort();
    else external?.addEventListener('abort', abort, { once: true });
    try {
      await relay.stop(); controller.signal.throwIfAborted();
      let snapshot: SseFeedSnapshot;
      if (props.loadSnapshot) snapshot = await props.loadSnapshot({ scope: props.scope, signal: controller.signal });
      else {
        const context = { scope: props.scope, signal: controller.signal, attempt: relay.attempt,
          isCurrent: () => !controller.signal.aborted };
        const supplied = typeof props.transport?.headers === 'function'
          ? await props.transport.headers(context) : props.transport?.headers;
        controller.signal.throwIfAborted();
        const headers = new Headers(supplied);
        headers.set('Accept', 'application/json'); headers.delete('Last-Event-ID');
        const response = await (props.transport?.fetch ?? globalThis.fetch)(props.snapshotUrl!, {
          method: 'GET', signal: controller.signal, headers, redirect: 'error', cache: 'no-store',
          credentials: props.transport?.credentials ?? 'same-origin',
        });
        if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new Error('Snapshot request failed'); }
        snapshot = await readSnapshotJson(response, props.snapshotMaxBytes ?? FeedDefaults.SNAPSHOT_MAX_BYTES, controller.signal) as SseFeedSnapshot;
      }
      controller.signal.throwIfAborted();
      if (snapshot.scope?.accountId !== props.scope.accountId || snapshot.scope?.streamId !== props.scope.streamId
        || !Array.isArray(snapshot.items)) throw new TypeError('Snapshot scope or items are invalid');
      validateCursor(snapshot.cursor);
      const decoded = snapshot.items.map(props.decode);
      // Install the complete view synchronously before the corresponding cursor can be saved.
      // Синхронно устанавливаем список до сохранения соответствующего ему курсора.
      store.replace(decoded, props.getKey);
      relay.resume(snapshot.cursor);
    } catch {
      if (mounted.current && (timedOut || !controller.signal.aborted)) setFailed(true);
    } finally {
      clearTimeout(deadline);
      external?.removeEventListener('abort', abort);
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const needsSnapshot = busy || relay.state === 'resync' || failed;
  return <section className={props.className} style={{ color: 'inherit', background: 'transparent', border: '1px solid #94a3b8',
    borderRadius: 12, padding: 20, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, ...props.style }} aria-label={props.title ?? copy.title} aria-busy={busy}>
    <header style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{props.title ?? copy.title}</h2>
      <SseConnectionStatus {...(props.locale === 'ru' ? { labels: RU_STATUS } : {})} />
    </header>
    <p data-feed-count={items.length}>{copy.count}: {items.length}</p>
    {items.length ? <ul style={{ paddingLeft: 24, maxHeight: '24rem', overflowY: 'auto' }}>
      {items.map(item => <li key={props.getKey(item)} style={{ paddingBlock: 8 }}>{props.renderItem(item)}</li>)}
    </ul> : <p>{copy.empty}</p>}
    {needsSnapshot && <p>{copy.missing}</p>}
    {failed && <p role="alert">{copy.error}</p>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {needsSnapshot ? (props.loadSnapshot || props.snapshotUrl !== undefined) && <button type="button" style={button} disabled={busy || !props.scope} onClick={() => void recover()}>
        {busy ? copy.working : copy.recover}</button> : <>
        <button type="button" style={button} disabled={busy || relay.pending || !props.scope || !['closed', 'failed', 'idle'].includes(relay.state)} onClick={() => relay.reconnect()}>{copy.retry}</button>
        <button type="button" style={button} disabled={busy || relay.pending || !props.scope || ['closed', 'idle', 'failed'].includes(relay.state)} onClick={() => void relay.stop()}>{copy.pause}</button>
      </>}
    </div>
  </section>;
}
