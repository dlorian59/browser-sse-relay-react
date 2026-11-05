# Put a live order feed in your application

[← README](../README.md) · [Versions](index.md) · [Русский](integration.ru.md)

## 1. Choose the right object

`SseFeed` is a ready React list: one account/stream, one connection, an in-memory view and its matching checkpoint. Messages replace rows by a business key. Status, pause, reconnect and snapshot-recovery controls are included.

Use it for recent order activity, notifications and small live lists. It is not a complete event archive, an editable data grid or a general reducer for deletion commands. If you already have a domain store or need a different event model, keep that store and use `SseRelayProvider` + `useSseRelay` instead. The [existing provider walkthrough](v0.1.0/guide.en.md) shows this layer.

## 2. Add it to the existing project

Copy the dependencies and first component from [Get started](../README.md). There is no CSS installation step: the component has a small neutral layout, native buttons and an accessible live status. It inherits the surrounding text color and supports your own classes/styles.

```text
src/
  auth/session.ts                    your existing login/session
  orders/OrderNotifications.tsx       copy the complete integration module
  pages/OrdersPage.tsx                render OrderNotifications in your page
server/
  GET /api/events                    authenticated relay-protocol stream
  GET /api/snapshot                  consistent account state and cursor
```

The [complete integration module](../examples/orders/OrderNotifications.tsx) receives an `OrderSession` from your existing OAuth integration. It memoizes DPoP transport, validates business fields and connects both server routes. It does not ask you to write list reducers, reconnect effects or cursor-storage code.

For local exploration, [run the example](../CONTRIBUTING.md) and open `/feed.html`. Its [screen](../examples/notifications/feed-main.tsx) imports the same component; [server routes](../examples/notifications/server.mjs) use a real relay and DPoP checks. Account selection/token issuance there is a synthetic fixture, not production OAuth.

<a id="business-fields"></a>
## 3. Describe only your business data

The example's message is `{ key, text }`: the key identifies an order notification and text is its current message.

- `decode(value)` validates an unknown JSON value and returns your typed object. Throwing rejects that event without committing its cursor.
- `getKey(item)` returns a non-empty stable business key. A repeated key replaces its row, so replayed notifications do not grow duplicate rows.
- `renderItem(item)` returns your row content. Use normal React text/elements; the feed does not inject HTML.

These three callbacks are business configuration. The package owns the state updates, finite retries, connection teardown and checkpoint ordering. Updating an existing key keeps its position; inserting a new key appends a row. For custom removals, sorting or transactional side effects, use the provider layer.

<a id="snapshot"></a>
## 4. Recover a retention gap

A server may discard old events before a browser returns. The feed then shows that a snapshot is required. `snapshotUrl="/api/snapshot"` enables the built-in restore action with the same authenticated fetch, headers and credentials. For an existing application SDK, supply `loadSnapshot` instead. Providing both is a configuration error:

1. The component stops and waits for the old connection.
2. It requests the snapshot URL, or calls your custom loader with `{scope,signal}`.
3. It validates the returned scope/cursor and decodes all items before replacing anything.
4. It installs the list synchronously, then resumes from the corresponding cursor.

The server response is:

```json
{
  "scope": { "accountId": "verified-account", "streamId": "notifications" },
  "cursor": "opaque-server-position",
  "items": [{ "key": "order-42", "text": "Order 42 shipped" }]
}
```

State and cursor must come from one consistent server snapshot. The server derives the account from verified authentication; the example account string above is a response shape, not an authorization mechanism. The package checks shape/scope but cannot prove that an arbitrary server captured them atomically.

A loader error or wrong scope keeps the old view and offers another restore attempt. Unmount/account replacement aborts the loader; a late result cannot enter the new account. A missing loader leaves the explicit snapshot-required status visible, rather than skipping missing events.

<a id="limits"></a>
## 5. Keep display and connection lifetimes aligned

`FeedDefaults.MAX_ITEMS` is 100. Set `maxItems` only if the product needs a different display window. Oldest inserted keys leave the list when the window fills; this does not delete server events. Snapshot HTTP responses are separately bounded before JSON parsing by `snapshotMaxBytes`, which defaults to `FeedDefaults.SNAPSHOT_MAX_BYTES` (1 MiB). Both Content-Length and received body bytes are checked; overflow cancels the reader and leaves the previous view/cursor unchanged.

`snapshotTimeoutMs` defaults to `FeedDefaults.SNAPSHOT_TIMEOUT_MS` (10 seconds) for the entire recovery operation. Timeout cancels the HTTP request/body, preserves the old view and re-enables restore. It also aborts the signal supplied to a custom `loadSnapshot`; custom loaders, token readers and header callbacks must cooperate with cancellation and settle their promises. A custom loader owns its response/object memory limit; the HTTP byte bound cannot inspect data already produced by that SDK.

The feed privately owns both list and memory checkpoint. It does not expose an external persistent checkpoint because the view itself is not durable. Changing account, stream or `maxItems` replaces both together. Reload requires replay or a snapshot. Returning to an old account never resurrects its previous view.

Pause stops incoming work while retaining the view. Reconnect is an explicit user action that starts a new finite attempt budget. Automatic network retry remains bounded. A scope change/unmount also stops the old connection. React Activity may keep view/checkpoint memory while cleaning up effects; no React 19-only API is required by the package.

<a id="component-api"></a>
## 6. Configure appearance and integration

| Prop | Purpose / default |
|---|---|
| `scope` | Authenticated `{accountId,streamId}`, or `null` for a signed-out/idle view. |
| `url` | Existing relay endpoint; string or base-library URL callback. |
| `decode`, `getKey`, `renderItem` | Required business shape, identity and presentation. |
| `transport` | Optional stable base transport configuration: authenticated fetch, token refresh, retry/profile options. |
| `snapshotUrl` | Standard JSON snapshot route; uses the same authenticated GET transport, headers and credentials, with cancellation and no redirects. |
| `snapshotMaxBytes` | Positive safe integer; HTTP snapshot body byte ceiling before JSON parsing. Default `FeedDefaults.SNAPSHOT_MAX_BYTES` (1 MiB). |
| `snapshotTimeoutMs` | Positive platform timer, at most 2147483647 ms. Default `FeedDefaults.SNAPSHOT_TIMEOUT_MS` (10 s). Entire recovery, including cooperative SDK loaders. |
| `loadSnapshot` | Alternative async SDK loader. Choose it instead of snapshotUrl; receives scope/signal. |
| `maxItems` | Positive integer; defaults to `FeedDefaults.MAX_ITEMS`. Changing it resets the session/view. |
| `locale` | `en` or `ru`; default `en`. Built-in controls and statuses only; business text is yours. |
| `title` | Section heading and accessible label. Defaults to Notifications / Уведомления. |
| `className`, `style` | Host styles; `renderItem` customizes row content. |

The status is one polite live region; buttons are native, keyboard accessible and disabled while an operation is unavailable. Snapshot errors use an alert. The recorded animation has a [static alternative](assets/feed.png); the actual component does not force decorative motion.

## 7. Reuse the existing authenticated session

Pass a stable transport. For DPoP, the [complete module](../examples/orders/OrderNotifications.tsx) uses `createDpopFetch` with the same key that obtained the access token. Your OAuth SDK supplies the current token and optional refresh operation. The adapter signs each GET/reconnect and handles a nonce challenge; it does not create login credentials. [Core DPoP setup](https://github.com/dlorian59/browser-sse-relay/blob/main/docs/dpop.en.md).

The Node fixture closes streams at token expiry and verifies proof signatures, binding and replay. Its in-memory log and arbitrary-account login are for reproduction only. A production relay needs its actual auth and retention backend.

## Common mistakes

- **New transport object on every render:** memoize it so a harmless page render does not restart the connection.
- **A changing or empty business key:** rows cannot be safely replaced. Use the stable domain identifier, not an array index.
- **A snapshot assembled from unrelated reads:** the list and cursor can disagree. Capture them consistently on the server.
- **Treating 100 displayed rows as all business data:** this is a display window. Use your domain API for full reports.
- **A permanent cursor with an empty list:** SseFeed avoids that mismatch by owning memory for both. For custom durable state, use the provider and an explicit persistence design.

[Recorded behavior and code](visual.en.md) · [Provider/hook API](v0.1.0/reference.en.md) · [Verification](VERIFICATION.md) · [← README](../README.md)
