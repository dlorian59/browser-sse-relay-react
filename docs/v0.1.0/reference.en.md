# React API reference · 0.1.0 · English

[← Documentation](../index.md) · [Guide](guide.en.md) · [Русский](reference.ru.md) · [README](../../README.md)

Public runtime exports: SseRelayProvider, useSseRelay, SseConnectionStatus. Public types: SseRelayProviderProps, SseRelayValue, SseConnectionStatusProps, RelayActions, RelaySnapshot, RelayTransportOptions. SessionOwner/SessionConfig are internal implementation details, not package exports. [Public source](https://github.com/dlorian59/browser-sse-relay-react/blob/main/src/index.tsx), [lifecycle source](https://github.com/dlorian59/browser-sse-relay-react/blob/main/src/session.ts).

## Provider props and identity

| Prop | Default / contract |
|---|---|
| scope | Required StreamScope or null. accountId/streamId values identify the session; a new object with unchanged values does not reconnect. null disables connection. Auth still belongs to the server. |
| url | Required base RelayOptions.url: string or sync/async context callback. Memoize function URLs; changing their identity replaces the session. |
| onEvent | Required base RelayOptions.onEvent. Awaited handler; may be inline. Updated callback becomes current in an effect without replacing the transport. Existing async invocations continue their original body and must honor context cancellation. |
| checkpoint | Optional CheckpointStore. Default: provider-owned MemoryCheckpointStore; reset on scope change or disabled provider. Memoize custom stores; changing identity replaces the connection. |
| transport | Optional RelayTransportOptions. Inherits base options/defaults below; memoize to avoid replacement on every render. |
| enabled | true. false disables connection and resets default memory checkpoint; use stop() for a pause preserving that checkpoint. |
| children | Optional ReactNode. Descendants access this provider's session; nested providers own independent sessions. |

The default memory checkpoint and view state must share a lifetime. A supplied durable store has its own policy; the wrapper does not erase all scopes on identity change. Same-scope providers or tabs require external single-writer coordination. Retained actions cannot reconnect after effect cleanup/unmount; re-created effects may configure a new run. Account changes mask previous snapshot fields synchronously during render; disabling resets terminal diagnostics and attempt as well as scope/cursor.

Transport options deliberately omit scope/url/onEvent/checkpoint/onState/initialCursor. Pass those through provider props or resume(), observe state with the hook. [Base API/defaults](https://github.com/dlorian59/browser-sse-relay/blob/main/docs/v0.1.0/reference.en.md).

| transport field | Inherited default / purpose |
|---|---|
| headers | Absent; HeadersInit or context callback rebuilt per attempt; library owns Accept/Last-Event-ID. |
| credentials | same-origin. |
| signal | Absent; external abort stops the run. Reconnecting with an already-aborted signal still stops. |
| refreshAuth | Absent; HTTP401 sync/async boolean refresh, bounded by connection budget. |
| fetch | globalThis.fetch; compatible injectable implementation. |
| connectTimeoutMs / idleTimeoutMs | 10000 / 45000; response-header wait / incoming-byte idle, not handler deadlines. |
| retry | maxAttempts=8, minDelayMs=250, maxDelayMs=10000, jitter=0.2; total connections, not failures since last success. |
| limits | maxFrameBytes=65536, maxQueuedEvents=128, maxQueuedBytes=1048576, dedupEntries=1024. |
| random | Math.random; injectable jitter sample. |

## Hook value and actions

`useSseRelay(): SseRelayValue` throws outside a provider. It reads the nearest provider; it does not create a transport. Individual action functions are stable, but the merged hook result object is not promised stable. Prefer specific values/actions in effect dependencies instead of the whole result object.

| RelaySnapshot field | Initial / meaning |
|---|---|
| state | idle. Same RelayState union as base client. |
| scope | null initially or when disabled; otherwise frozen account/stream. |
| cursor | undefined initially; observed committed cursor. UI notifications may coalesce; not a durable effect/commit callback. |
| attempt | 0 initially; total connection attempt in the current base session. |
| pending | false initially. true while a start awaits the old owner or stop/logout waits for work. It is not a count of pending business events. |
| result | undefined initially; terminal RelayResult. A new run/disabled provider resets it. stop() can retain the previous diagnostic until the next run; inspect state as well. |

| RelayActions member | Return and boundary |
|---|---|
| stop() | Promise<void>: invalidate generation, abort transport, wait for in-flight processing/checkpoint. Keeps config and cursor; later reconnect can continue. |
| reconnect() | void: queue replacement after old work, load checkpoint, create a new one-shot client and retry budget. Does not restore application state. |
| resume(cursor) | void: queue replacement using cursor of state already installed by the application. Validation/failure appears in result, not as an awaited action result. |
| logout() | Promise<void>: stop/wait, clear captured scope/store. Rejects on clear error; status failed with reason logout-failed. Does not revoke credentials or automatically set scope=null. |

reconnect/resume do nothing when no configuration is active (disabled/null scope/unmounted). Lifecycle operations serialize within one provider. Do not wait for a different provider to acquire an implicit global lock; none exists. A handler/store that never settles blocks replacement deliberately rather than permitting concurrent writers.

## State, errors and accessible status

| State | Default text |
|---|---|
| idle | Not connected |
| connecting | Connecting |
| replaying | Restoring events |
| live | Up to date |
| waiting | Waiting to reconnect |
| authenticating | Refreshing authentication |
| resync | Snapshot required |
| failed | Connection stopped |
| closed | Disconnected |

Terminal protocol/auth/retry/resync details are base RelayResult. The wrapper additionally reports configuration-failed for constructor/setup errors and logout-failed when clear rejects. Errors are unknown values; inspect safely and avoid rendering credentials or arbitrary error messages. [Practical troubleshooting](guide.en.md#troubleshooting-and-boundaries).

SseConnectionStatusProps extends div HTML attributes except native children. labels is an optional partial state→string map; missing labels use the English defaults above. children is an optional `(value:SseRelayValue) => ReactNode` render callback and takes precedence over labels. It receives the same value/actions as the hook. className/style/id and other div attributes pass through. Defaults are role=status, aria-live=polite, aria-atomic=true; caller attributes may override these, so the caller then owns accessibility. data-state and aria-busy are controlled by the component. No imposed CSS, icons, error details, snapshot fetch or automatic retry button.

```tsx
import { SseConnectionStatus } from '@59alex/browser-sse-relay-react';
export function TranslatedStatus() {
  return <SseConnectionStatus labels={{ live: 'Connected', resync: 'Restore a snapshot', closed: 'Stopped' }}
    className="connection-status" />;
}
```

Place this component below a provider. [Runnable custom recovery controls](../../examples/notifications/main.tsx) demonstrate application-owned snapshot validation/error handling; every handler runs through the base checkpoint protocol.

## React 18 baseline and current React features

The library uses React 18-compatible context, refs, effects and useSyncExternalStore. The store supplies stable subscribe/getSnapshot functions, immutable cached snapshots and fixed idle getServerSnapshot, so SSR/hydration performs no network I/O. The public entry retains “use client”; callbacks/stores still belong in a host client component. Next.js itself is not an exercised integration.

The onEvent ref is updated in an effect rather than mutated during render, so an abandoned concurrent render does not overwrite the callback. It means the new callback is available after that effect, not synchronously during render. Refreshing onEvent does not restart SSE. useEffectEvent is not part of this public callback contract and is not passed into another component/hook: the current official API restricts those usages. This preserves React 18 support. [React external-store requirements](https://react.dev/reference/react/useSyncExternalStore), [Effect Event restrictions](https://react.dev/reference/react/useEffectEvent), [current React versions](https://react.dev/versions).

### Optional React 19.2+ Activity example

The source checkout demo uses React 19.3.1 and [Activity](https://react.dev/reference/react/Activity). ActivityExample in [main.tsx](../../examples/notifications/main.tsx) wraps App, keeping the provider and its notification state inside the same boundary. Hide dashboard cleans up the transport effects while retaining their state; Show dashboard re-creates effects and replays from the retained cursor. This does not call enabled=false, which intentionally resets the default checkpoint.

Run `npm run demo`. Publish notices, hide, then show. The browser test additionally publishes from the server while hidden: subscriptions become0; showing yields exactly one subscription and adds the missing notice to the retained seven. If retention expires while hidden, showing correctly enters resync and still needs a snapshot. Activity is not a global network pause: putting only a visual child inside it while leaving the provider outside would leave the subscription active. It also is not logout, durable storage, or page-reload recovery. Removing/unmounting the boundary discards its state.

React 18 consumers use the ordinary provider example in README; they must not import Activity. The dependency minimum remains React 18.3. [Activity source scenario](../../scripts/browser-smoke.mjs), [verification](../VERIFICATION.md).

[← Documentation](../index.md) · [Guide](guide.en.md) · [Русский](reference.ru.md)
