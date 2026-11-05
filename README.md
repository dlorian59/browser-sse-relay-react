# browser-sse-relay-react

<details name="readme-language">
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-en-dark.svg"><img src="assets/lang-en-light.svg" width="42" height="26" alt="EN"></picture></summary>

A ready live list for order updates, alerts and notifications. It receives events, updates matching rows, shows connection state and offers pause/reconnect/snapshot recovery. Your code describes the business fields and how a row looks; the component manages the list and connection.

The lower-level provider and hook remain available when you already own the screen state.

## Get started — your existing React application

Add these entries to your project's `package.json` alongside its existing React dependency:

```json
{ "dependencies": { "@59alex/browser-sse-relay": "0.1.0", "@59alex/browser-sse-relay-react": "0.1.0" } }
```

React 18.3+ and 19 are supported. These are current source coordinates; npm publication is pending, so your artifact source must provide the packages.

Copy this into `src/orders/OrderUpdates.tsx`. `accountId` and `authenticatedFetch` come from your existing login/session. The server must expose relay-protocol events and a consistent snapshot:

```tsx
import { useMemo } from 'react';
import { SseFeed } from '@59alex/browser-sse-relay-react';

interface Notice { key: string; text: string }
function decodeNotice(value: unknown): Notice {
  if (!value || typeof value !== 'object' || !('key' in value) || !('text' in value)
      || typeof value.key !== 'string' || !value.key || typeof value.text !== 'string') {
    throw new TypeError('Invalid order notification');
  }
  return { key: value.key, text: value.text };
}
export function OrderUpdates({ accountId, authenticatedFetch }: {
  accountId: string; authenticatedFetch: typeof fetch;
}) {
  const transport = useMemo(() => ({ fetch: authenticatedFetch }), [authenticatedFetch]);
  return <SseFeed scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport} title="Order updates"
    decode={decodeNotice} getKey={notice => notice.key} renderItem={notice => notice.text}
    snapshotUrl="/api/snapshot" />;
}
```

The snapshot has `{ scope: { accountId, streamId }, cursor, items }`; each event contains one `{ key, text }`. The feed validates scope/cursor and every item before recovery. For DPoP, pass `createDpopFetch(...)` as the authenticated transport.

[Full integration and file structure](docs/integration.en.md) · [Complete component](examples/orders/OrderNotifications.tsx)

## See the component

<picture><source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/feed.png"><img src="docs/assets/feed.gif" alt="Order feed: receive, pause, recover and switch account" width="800"></picture>

[Static image](docs/assets/feed.png) · [Recorded interactions and code](docs/visual.en.md)

## Capabilities

- **A working list:** `<SseFeed decode={decodeNotice} getKey={n => n.key} renderItem={n => n.text} ... />` owns the state and replaces existing rows by key. [Business fields](docs/integration.en.md#business-fields).
- **A bounded display:** `maxItems={FeedDefaults.MAX_ITEMS}` keeps the latest 100 inserted keys by default. This is a display window, not your complete event history. [Limits](docs/integration.en.md#limits).
- **Recovery without screen plumbing:** `snapshotUrl="/api/snapshot"` enables the built-in restore button and installs data before its cursor. [Snapshot contract](docs/integration.en.md#snapshot).
- **Your own layout:** `<SseRelayProvider ...>` + `useSseRelay()` lets an existing store handle events. [Provider/hook guide](docs/v0.1.0/guide.en.md).
- **Russian UI:** `locale="ru"` translates built-in controls and statuses; `title`, `className`, `style` and `renderItem` customize presentation. [Component API](docs/integration.en.md#component-api).

## Continue learning

[Guided integration](docs/integration.en.md) → [All capabilities and controls](docs/v0.1.0/guide.en.md) → [API](docs/v0.1.0/reference.en.md). [Versions/languages](docs/index.md) · [Develop/run examples](CONTRIBUTING.md).

The component keeps state in memory. Reload or a discarded scope requires replay or a matching snapshot. It does not issue OAuth tokens, provide a durable log or promise exactly-once business effects. MIT: [LICENSE](LICENSE).

</details>

<details name="readme-language" open>
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-ru-dark.svg"><img src="assets/lang-ru-light.svg" width="42" height="26" alt="RU"></picture></summary>

Готовый список для состояния заказов, оповещений и уведомлений. Получает события, обновляет строки по ключу, показывает состояние соединения и даёт кнопки паузы, подключения и восстановления. Вы описываете бизнес-поля и вид строки; список и соединение обслуживает компонент.

Если состоянием экрана уже управляет приложение, можно использовать отдельные provider и hook.

## Get started — существующее React-приложение

Добавьте зависимости в `package.json` проекта рядом с уже используемым React:

```json
{ "dependencies": { "@59alex/browser-sse-relay": "0.1.0", "@59alex/browser-sse-relay-react": "0.1.0" } }
```

Поддерживаются React 18.3+ и 19. Это координаты текущих исходников; публикация npm ожидается, поэтому пакеты должны быть доступны из вашего источника артефактов.

Поместите код в `src/orders/OrderUpdates.tsx`. `accountId` и `authenticatedFetch` берутся из существующей авторизации. Сервер предоставляет события протокола relay и согласованный снимок:

```tsx
import { useMemo } from 'react';
import { SseFeed } from '@59alex/browser-sse-relay-react';

interface Notice { key: string; text: string }
function decodeNotice(value: unknown): Notice {
  if (!value || typeof value !== 'object' || !('key' in value) || !('text' in value)
      || typeof value.key !== 'string' || !value.key || typeof value.text !== 'string') {
    throw new TypeError('Invalid order notification');
  }
  return { key: value.key, text: value.text };
}
export function OrderUpdates({ accountId, authenticatedFetch }: {
  accountId: string; authenticatedFetch: typeof fetch;
}) {
  const transport = useMemo(() => ({ fetch: authenticatedFetch }), [authenticatedFetch]);
  return <SseFeed scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport} title="Order updates"
    decode={decodeNotice} getKey={notice => notice.key} renderItem={notice => notice.text}
    snapshotUrl="/api/snapshot" />;
}
```

Снимок содержит `{ scope: { accountId, streamId }, cursor, items }`, событие — один объект `{ key, text }`. Перед восстановлением feed проверяет область, курсор и каждую запись. Для DPoP используйте `createDpopFetch(...)` как авторизованный транспорт.

[Полная интеграция и структура файлов](docs/integration.ru.md) · [Полный компонент](examples/orders/OrderNotifications.tsx)

## Работа компонента

<picture><source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/feed.png"><img src="docs/assets/feed.gif" alt="Order feed: receive, pause, recover and switch account" width="800"></picture>

[Статичное изображение](docs/assets/feed.png) · [Записанные действия и код](docs/visual.ru.md)

## Возможности

- **Готовый список:** `<SseFeed decode={decodeNotice} getKey={n => n.key} renderItem={n => n.text} ... />` хранит записи и заменяет строку с тем же ключом. [Бизнес-поля](docs/integration.ru.md#business-fields).
- **Ограничение отображения:** `maxItems={FeedDefaults.MAX_ITEMS}` по умолчанию оставляет 100 последних добавленных ключей. Это окно экрана, а не полная история событий. [Ограничения](docs/integration.ru.md#limits).
- **Восстановление без обвязки экрана:** `snapshotUrl="/api/snapshot"` включает готовую кнопку и устанавливает данные до сохранения курсора. [Контракт снимка](docs/integration.ru.md#snapshot).
- **Собственная разметка:** `<SseRelayProvider ...>` + `useSseRelay()` позволяют применять события к уже существующему хранилищу приложения. [Provider и hook](docs/v0.1.0/guide.ru.md).
- **Русский интерфейс:** `locale="ru"` переводит кнопки и состояния; `title`, `className`, `style`, `renderItem` настраивают внешний вид. [API компонента](docs/integration.ru.md#component-api).

## Дальнейшее освоение

[Пошаговая интеграция](docs/integration.ru.md) → [Все возможности и управление](docs/v0.1.0/guide.ru.md) → [API](docs/v0.1.0/reference.ru.md). [Версии/языки](docs/index.md) · [Разработка и запуск примеров](CONTRIBUTING.md).

Состояние хранится в памяти. После reload или удаления области нужны повтор событий либо согласованный снимок. Компонент не выдаёт OAuth-токены, не хранит долговечный журнал и не обещает exactly-once для бизнес-действий. MIT: [LICENSE](LICENSE).

</details>
