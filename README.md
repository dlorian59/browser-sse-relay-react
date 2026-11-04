# browser-sse-relay-react

<details name="readme-language">
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-en-dark.svg"><img src="assets/lang-en-light.svg" width="42" height="26" alt="EN"></picture></summary>

0.1.0 · [Guide / Руководство](docs/v0.1.0/guide.en.md) · [Versions / Версии](docs/index.md)

React ownership for an SSE connection: one provider, an event handler, and a status component. Replay, checkpointing, authentication and protocol validation stay in browser-sse-relay.

**0.1.0 is a local source candidate. Public repository creation and npm publication are pending.**

## Capabilities

| Capability | What it does |
|---|---|
| Provider and hook | One connection per provider; typed status, committed cursor and actions through useSseRelay. |
| Connection status | Unstyled accessible live region; translate labels or render custom recovery controls. |
| React lifecycle | StrictMode-safe setup, serialized teardown/replacement, scope isolation, idle SSR. |
| Snapshot recovery | Stop, install application state, then resume its matching cursor; no new wire protocol. |
| Scoped logout | Wait for in-flight work and clear the current account checkpoint before replacement. |

## Try locally

Use sibling checkouts of browser-sse-relay and browser-sse-relay-react. Node 22.12+ is required for development. The bootstrap builds and packs the unpublished base library, then installs that local artifact without changing the public peer dependency.

```bash
npm run bootstrap
npm test
npm run demo
```

Open the printed loopback URL. Publish a notification, disconnect, create a retention gap, then restore a snapshot. The [notification example](examples/notifications/main.tsx) and [reference server](examples/notifications/server.mjs) are executable source, not a documentation website.

## Minimal integration

The endpoint must implement browser-sse-relay protocol v1. Scope is the authenticated account and logical stream, not a way to authorize a request.

```tsx
import { useState } from 'react';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Notifications() {
  const [messages, setMessages] = useState<Record<string, string>>({});
  return <SseRelayProvider
    scope={{ accountId: 'authenticated-account', streamId: 'notifications' }}
    url="/api/events"
    onEvent={(event, context) => {
      if (context.isCurrent()) setMessages(previous =>
        context.isCurrent() ? { ...previous, [event.id]: event.data } : previous);
    }}>
    <SseConnectionStatus />
    <ul>{Object.entries(messages).map(([id, text]) => <li key={id}>{text}</li>)}</ul>
  </SseRelayProvider>;
}
```

The default in-memory checkpoint survives reconnects in this provider and resets when scope changes, the provider is disabled, or the provider is discarded. Keep the application view state for that same lifetime. If the view state is lost, recover a snapshot; a cursor alone cannot reconstruct it. React state updates are not durable transactions.

Memoize transport options, a custom checkpoint store and function URLs; an inline event handler does not reconnect. The public entry includes “use client” for React Server Component boundaries. The component still supports idle server rendering; event callbacks and stores belong in a client component.

React 18.3+/19 peer support, TypeScript declarations, ES2022 ESM. Tested with React 18.3.1 (packed consumer/SSR) and 19.3.1 (headless browser). No React 19-only API. [Guide](docs/v0.1.0/guide.en.md) · [Verification](docs/VERIFICATION.md).

## Boundaries

Exactly-once effects, persistent application state, cross-tab ownership and distributed relay storage are not provided. Your awaited handler must be idempotent and cancellation-aware. A durable checkpoint needs matching application state. One provider owns a checkpoint scope; do not run independent providers against the same scope/store. The Node example uses synthetic demo tokens and an in-memory log, not production authentication or storage.

MIT licensed. See [LICENSE](LICENSE).

</details>

<details name="readme-language" open>
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-ru-dark.svg"><img src="assets/lang-ru-light.svg" width="42" height="26" alt="RU"></picture></summary>

0.1.0 · [Guide / Руководство](docs/v0.1.0/guide.ru.md) · [Versions / Версии](docs/index.md)

Управление SSE-подключением в React: один provider, обработчик события и компонент статуса. Replay, checkpoint, аутентификация и проверка протокола остаются в browser-sse-relay.

**0.1.0 — локально подготовленный код. Создание публичного репозитория и публикация npm ещё не выполнены.**

## Возможности

| Возможность | Что делает |
|---|---|
| Provider и hook | Одно подключение на provider; типизированные статус, подтверждённый курсор и действия через useSseRelay. |
| Статус подключения | Доступная live region без навязанного оформления; перевод подписей или собственные элементы восстановления. |
| Жизненный цикл React | Корректная работа StrictMode, последовательное завершение и замена сессий, изоляция scope, SSR без I/O. |
| Восстановление снимком | Остановить поток, применить состояние приложения и продолжить с соответствующего курсора; протокол не меняется. |
| Выход из аккаунта | Дождаться текущей обработки и удалить checkpoint аккаунта до замены подключения. |

## Локальный запуск

Расположите browser-sse-relay и browser-sse-relay-react рядом. Для разработки нужен Node 22.12+. Bootstrap собирает архив ещё не опубликованной базовой библиотеки и устанавливает его, сохраняя semver peer dependency пакета.

```bash
npm run bootstrap
npm test
npm run demo
```

Откройте напечатанный loopback URL. Создайте уведомление, оборвите соединение, исчерпайте историю и восстановите снимок. [Пример уведомлений](examples/notifications/main.tsx) и [reference server](examples/notifications/server.mjs) — исполняемые исходники, а не отдельный сайт документации.

## Минимальное подключение

Endpoint должен поддерживать browser-sse-relay protocol v1. Scope обозначает авторизованный аккаунт и логический поток, но сам по себе не авторизует запрос.

```tsx
import { useState } from 'react';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Notifications() {
  const [messages, setMessages] = useState<Record<string, string>>({});
  return <SseRelayProvider
    scope={{ accountId: 'authenticated-account', streamId: 'notifications' }}
    url="/api/events"
    onEvent={(event, context) => {
      if (context.isCurrent()) setMessages(previous =>
        context.isCurrent() ? { ...previous, [event.id]: event.data } : previous);
    }}>
    <SseConnectionStatus />
    <ul>{Object.entries(messages).map(([id, text]) => <li key={id}>{text}</li>)}</ul>
  </SseRelayProvider>;
}
```

Checkpoint по умолчанию хранится в памяти: переживает переподключения внутри provider и сбрасывается при смене scope, отключении или удалении provider. Состояние представления должно жить столько же. Если оно потеряно, восстановите снимок: одного курсора недостаточно. Обновления React state не являются надёжной транзакцией.

Мемоизируйте transport, пользовательский checkpoint store и URL-функцию; inline-обработчик события не переподключает поток. Публичный entry содержит «use client» для границы React Server Components. Начальный SSR остаётся без I/O; callbacks и store передаются из client component.

Peer-совместимость React 18.3+/19, типы TypeScript, ES2022 ESM. Проверены React 18.3.1 (установленный архив/SSR) и 19.3.1 (headless-браузер). API только для React 19 не используется. [Руководство](docs/v0.1.0/guide.ru.md) · [Проверки](docs/VERIFICATION.md).

## Границы

Библиотека не предоставляет exactly-once эффекты, постоянное состояние приложения, владение между вкладками и распределённое хранилище relay. Awaited-обработчик должен учитывать отмену и повторы. Постоянному checkpoint соответствует состояние приложения. Один provider владеет scope; независимые providers не должны использовать один scope/store. В Node-примере синтетические токены и журнал в памяти; это не production-аутентификация или хранилище.

Лицензия MIT: [LICENSE](LICENSE).

</details>
