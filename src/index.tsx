'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { CheckpointStore, RelayOptions, StreamScope } from '@59alex/browser-sse-relay';
import { SessionOwner } from './session.js';
import type { RelayActions, RelaySnapshot, RelayTransportOptions } from './session.js';
export type { RelayActions, RelaySnapshot, RelayTransportOptions } from './session.js';

export interface SseRelayProviderProps {
  scope: StreamScope | null;
  url: RelayOptions['url'];
  onEvent: RelayOptions['onEvent'];
  checkpoint?: CheckpointStore;
  transport?: RelayTransportOptions;
  enabled?: boolean;
  children?: ReactNode;
}
const RelayOwnerContext = createContext<{ owner: SessionOwner; account: string | undefined; stream: string | undefined } | null>(null);
/** One checkpoint owner per mounted provider. Memoize transport/checkpoint and function URLs. */
export function SseRelayProvider({ scope, url, onEvent, checkpoint, transport, enabled = true, children }: SseRelayProviderProps): ReactNode {
  const [owner] = useState(() => new SessionOwner());
  const callback = useRef(onEvent);
  useEffect(() => { callback.current = onEvent; }, [onEvent]);
  const account = scope?.accountId, stream = scope?.streamId;
  const context = useMemo(() => ({ owner, account: enabled ? account : undefined, stream: enabled ? stream : undefined }), [owner, enabled, account, stream]);
  useEffect(() => owner.configure(enabled && account !== undefined && stream !== undefined
    ? { scope: { accountId: account, streamId: stream }, url,
        onEvent: (event, context) => callback.current(event, context),
        ...(checkpoint === undefined ? {} : { checkpoint }), ...(transport === undefined ? {} : { transport }) }
    : null), [owner, enabled, account, stream, url, checkpoint, transport]);
  return <RelayOwnerContext.Provider value={context}>{children}</RelayOwnerContext.Provider>;
}
export type SseRelayValue = RelaySnapshot & RelayActions;
/** State and controls for the nearest provider. Never starts a second transport. */
export function useSseRelay(): SseRelayValue {
  const context = useContext(RelayOwnerContext);
  if (!context) throw new Error('useSseRelay must be used inside SseRelayProvider');
  const { owner } = context;
  const observed = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
  // Mask the previous account during render, before effect cleanup/configuration runs.
  // Скрываем прошлый аккаунт уже при рендере, до очистки и настройки эффектов.
  const snapshot = observed.scope && (observed.scope.accountId !== context.account || observed.scope.streamId !== context.stream)
    ? owner.getServerSnapshot() : observed;
  return { ...snapshot, ...owner.actions };
}
export interface SseConnectionStatusProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  labels?: Partial<Record<RelaySnapshot['state'], string>>;
  children?: (value: SseRelayValue) => ReactNode;
}
const DEFAULT_LABELS: Record<RelaySnapshot['state'], string> = {
  idle: 'Not connected', connecting: 'Connecting', replaying: 'Restoring events', live: 'Up to date',
  waiting: 'Waiting to reconnect', authenticating: 'Refreshing authentication', resync: 'Snapshot required',
  failed: 'Connection stopped', closed: 'Disconnected',
};
/** Accessible, unstyled live status. Children customize content; the caller owns recovery actions. */
export function SseConnectionStatus({ labels, children, ...attributes }: SseConnectionStatusProps): ReactNode {
  const value = useSseRelay();
  return <div role="status" aria-live="polite" aria-atomic="true" {...attributes} data-state={value.state} aria-busy={value.pending}>
    {children ? children(value) : labels?.[value.state] ?? DEFAULT_LABELS[value.state]}
  </div>;
}
export { SseFeed, FeedDefaults } from './feed.js';
export type { SseFeedProps, SseFeedSnapshot } from './feed.js';
