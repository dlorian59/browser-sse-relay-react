# Notification dashboard · 0.1.0 · English

[← Documentation](../index.md) · [README](../../README.md) · [Русский](guide.ru.md)

[Complete API and defaults](reference.en.md)

## Task and result

An order dashboard receives notifications while the user is signed in. A network interruption must not create a second subscription. If retained history expires, the UI must explain that a snapshot is needed. Switching accounts must not carry the previous account's cursor or notifications into the new view.

The runnable example connects a React StrictMode view to a real Node HTTP relay. Three retained events intentionally make expiry easy to reproduce. Seven notifications are recovered after the example's gap scenario; they are not reconstructed from an expired cursor.

## Configuration and run

Use sibling source checkouts named browser-sse-relay and browser-sse-relay-react. These packages are not yet published. Node 22.12+ is the development minimum; local verification used Node 24.21.0.

```bash
npm run bootstrap
npm test
npm run demo
```

For another base checkout: `SSE_RELAY_SOURCE=/absolute/path/browser-sse-relay npm run bootstrap`. The script builds and packs that source into output/, then installs the artifact with React/Vite development dependencies. It does not replace the semver peer in package.json with a local file path. Development dependencies are version-pinned directly; no transitive lockfile is claimed for this bootstrap workflow.

Open the loopback URL printed by the server. No desktop window opens automatically. The Vite app and HTTP API share one origin. Demo authentication accepts only the synthetic demo-alice and demo-bob bearer tokens; real applications must authenticate and authorize server-side.

## Source map

| Source | Responsibility |
|---|---|
| [main.tsx](../../examples/notifications/main.tsx) | Provider, authenticated scope, validated notification upsert, status, scoped logout and snapshot recovery. |
| [server.mjs](../../examples/notifications/server.mjs) | Reference relay, scoped business state, atomic synchronous snapshot/cursor read, deterministic retention expiry. |
| [browser-smoke.mjs](../../scripts/browser-smoke.mjs) | Real-browser lifecycle and recovery assertions. |

Comments in example files appear in English followed by Russian. The server's log and application data are in-memory demo state. Production snapshot consistency needs an actual transactional model, not this single-process assumption.

## One provider and one subscription

See the complete minimal component in the [README](../../README.md). Supply scope, URL and onEvent; the provider owns the transport and default memory checkpoint. Use `useSseRelay()` in descendants for state, scope, committed cursor, attempt, pending cleanup, terminal result and actions.

Inline event callbacks are supported. Scope identity uses accountId and streamId values. Memoize transport objects, custom checkpoint stores and function URLs: changing their identity replaces the connection. Changing onEvent alone does not reconnect. Use a client component for callback/store props in React Server Component applications; the package entry preserves the “use client” directive. SSR renders idle and does not fetch.

```tsx
import { useMemo } from 'react';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function AuthenticatedStream({ accountId, token }: { accountId: string; token: string }) {
  const transport = useMemo(() => ({
    headers: () => ({ Authorization: `Bearer ${token}` }),
    retry: { maxAttempts: 8, minDelayMs: 300, maxDelayMs: 3000 },
  }), [token]);
  return <SseRelayProvider scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport} onEvent={event => { console.log(event.data); }}>
    <SseConnectionStatus />
  </SseRelayProvider>;
}
```

Expected: token changes replace the session after old work settles. Headers refresh on attempts through the existing base client. Optional transport.refreshAuth follows the base 401 contract. This wrapper neither acquires tokens nor authorizes a user by a client-supplied accountId.

## Status and recovery controls

`SseConnectionStatus` supplies a polite, atomic live region and data-state. It has no CSS dependency. Translate its labels, or use a render callback. Keep recovery a deliberate application action.

```tsx
import { SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Connection({ restoreSnapshot }: { restoreSnapshot: () => Promise<void> }) {
  return <SseConnectionStatus className="connection">
    {relay => <>
      <span>{relay.state === 'resync' ? 'Snapshot required' : relay.state}</span>
      {relay.state === 'resync' && <button disabled={relay.pending}
        onClick={() => void restoreSnapshot()}>Restore notifications</button>}
    </>}
  </SseConnectionStatus>;
}
```

Mount this component below the provider. The host's restoreSnapshot callback must handle errors and duplicate clicks, as the runnable Dashboard does. Error details are available through relay.result; the component does not render arbitrary server error messages by default.

## Replay, snapshot and application state

1. Click Publish notification: a validated notification is upserted by business key. Repeated delivery does not duplicate that view item.
2. Click Disconnect: the relay closes the socket; the existing client reconnects from its committed cursor.
3. Click Create retention gap: stop processing, append six notifications while retaining three, then reconnect. State becomes resync, not a falsely healthy live stream.
4. Click Restore snapshot: stop and await old work; fetch `{ scope, items, cursor }`; validate it and reject stale responses; install items; call `resume(cursor)`. The resulting list contains seven notices.

The [recover function](../../examples/notifications/main.tsx) contains the complete runnable sequence. `resume` does not fetch or install state. The snapshot's cursor must represent exactly the state installed by the caller. The reference server reads both synchronously without an await; production servers need equivalent consistency.

Default checkpoints are in memory and reset on scope changes, including A → B → A, and when the provider is disabled. Use stop() to pause while retaining the same cursor. Keep view state for the same provider/scope lifetime. If view state is cleared while the provider remains mounted, stop and restore a snapshot before resuming. If a new provider starts without a cursor, it can only replay the history that the server still retains; it cannot know about older missing business state. If origin was pruned, the reference server returns resync instead of silently replaying a partial log. A complete dashboard should fetch an initial snapshot whenever retained history alone is insufficient.

A custom durable checkpoint deliberately survives account changes and provider remounts. It is only a position, not the corresponding application state. Restore state and cursor together, or obtain a fresh snapshot before enabling the provider. Never load a durable cursor into an empty view and pretend that replay reconstructs everything.

## Stop, switch account and logout

| Action | Behavior |
|---|---|
| `await stop()` | Abort transport, wait for current handler/checkpoint, retain the cursor for the same state. |
| `reconnect()` | Replace the session, load its checkpoint after old work settles. |
| `resume(cursor)` | Replace the session using the cursor of state already installed by the caller. |
| `await logout()` | Stop, wait for work, then clear the current scope checkpoint. Storage failure rejects and is visible in status. |
| `scope={null}` / `enabled={false}` | Stop automatic connection and reset the default memory store; no authentication side effect. |

The demo awaits logout, clears view state, then changes account. Failed checkpoint clearing prevents that action from claiming successful logout. Do not start another independent provider for the same checkpoint scope until cleanup has completed. React effect cleanup cannot itself be awaited by React: keep one provider for account replacement, or let the host coordinate remounts. The library serializes work inside one provider, not across tabs or separate providers.

An in-flight asynchronous handler must inspect context.signal/context.isCurrent() before applying late effects and settle promptly on cancellation. Uncooperative handlers/stores delay teardown; the wrapper does not race them with another checkpoint writer. There is no rollback of already performed effects. After unmount, retained reconnect/resume actions do not start another connection.

## Optional Activity: preserve a hidden dashboard

The runnable demo uses React 19.3.1. Its Hide dashboard / Show dashboard buttons exercise Activity (React 19.2+): both notification state and provider stay inside the boundary, while effect cleanup closes SSE. Showing the panel replays events into the retained state. If history expired while hidden, recover a snapshot normally. This differs from enabled=false, which resets the default checkpoint. React18 users keep the ordinary provider example without Activity. [Exact lifecycle and source](reference.en.md#optional-react-192-activity-example).

## Verification and installation artifacts

```bash
npm run test:browser
npm run test:package
```

Browser verification requires the Playwright Chromium browser (`npx playwright install chromium` if absent). The package check installs the base and adapter tarballs into a clean consumer using React 18.3.1, compiles README/guide examples and renders status on the server. Real-browser verification uses React 19.3.1. Full details: [verification](../VERIFICATION.md).

The generated archives can be installed together in a consumer with a supported React version. This is local artifact verification, not an npm release. The optional development demo requires its source checkout and Vite dev dependencies.

## Troubleshooting and boundaries

| Symptom | Cause and action |
|---|---|
| repeated connections after renders | Memoize transport/store/function URL; keep a stable provider. |
| resync | The cursor is expired, history was lost or a queue bound was exceeded. Fetch matching state/cursor; do not blindly skip the gap. |
| closed with pending=true | An application handler or checkpoint operation is still settling. Honor cancellation and resolve/reject it. |
| empty dashboard after reload | Cursor survived while state did not. Restore a snapshot; cursor storage is not state storage. |
| configuration-failed | Check the terminal error and the base client's URL/scope/options validation. |
| logout-failed | Checkpoint clear failed. Handle the rejected logout promise before changing account state. |
| no events from ordinary EventSource server | This client requires browser-sse-relay protocol v1, not arbitrary SSE. |

No exactly-once effects, global ownership lock, durable relay, app-specific schema, auth provider, or initial business snapshot is supplied. The handler → checkpoint → cursor order is preserved; checkpoint failure can repeat an effect. The example's React state updates are not durable commits. Firefox/Safari and a Next.js application were not run for this adapter; no broad browser or framework matrix is implied.

[← Documentation](../index.md) · [README](../../README.md) · [Русский](guide.ru.md)
