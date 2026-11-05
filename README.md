# browser-sse-relay-react

<details name="readme-language">
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-en-dark.svg"><img src="assets/lang-en-light.svg" width="42" height="26" alt="EN"></picture></summary>

0.1.0 · [Guide](docs/v0.1.0/guide.en.md) · [API 0.1.0](docs/v0.1.0/reference.en.md) · [Versions](docs/index.md)

React ownership for an SSE connection: one provider, an event handler, and a status component. Replay, checkpointing, authentication and protocol validation stay in browser-sse-relay.

**0.1.0 source and examples are available in this repository. npm publication is pending; the guide covers local installation.**

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/recovery.png">
  <img src="docs/assets/recovery.gif" width="800" height="760" alt="Real SSE demo: disconnect, reconnect, expired history and snapshot recovery">
</picture>

[Static frame](docs/assets/recovery.png) · [Visual guide](docs/visual.en.md) · [Minimal integration](#minimal-integration)

Recorded from the real loopback demo with synthetic accounts. A snapshot restores expired history; the client does not replay deleted events. The visual guide explains the English interface and each action.

| Public API | Visual integration |
|---|---|
| SseRelayProvider | [Scoped children](docs/visual.en.md#sserelayprovider) |
| SseConnectionStatus | [Connection and recovery](docs/visual.en.md#sseconnectionstatus) |
| useSseRelay | [Actions](docs/visual.en.md#usesserelay) |
| Activity · optional React 19.2+ | [Hide and show](docs/visual.en.md#activity--react-192) |

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

The dev demo uses React 19.3.1; its optional Activity hide/show scenario requires React 19.2+. The library and minimal example remain compatible with React 18.3.

Open the printed loopback URL. Publish a notification, disconnect, create a retention gap, then restore a snapshot. The [notification example](examples/notifications/main.tsx) and [reference server](examples/notifications/server.mjs) are executable source, not a documentation website.

## Minimal integration

The endpoint must implement browser-sse-relay protocol v1. Supply the application-owned DPoP key and getAccessToken callback returning an OAuth token bound to that key; memoize the callback and origin. The wrapper signs each GET/reconnect and handles one nonce challenge. accountId must come from the verified OAuth session and match the token. Scope is the authenticated account and logical stream, not authorization. [DPoP integration and lifecycle](docs/v0.1.0/guide.en.md#dpop-session-ownership).

```tsx
import { useMemo, useState } from 'react';
import { createDpopFetch } from '@59alex/browser-sse-relay';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Notifications({ accountId, keyPair, getAccessToken, origin }: {
  accountId: string; keyPair: CryptoKeyPair; origin: string;
  getAccessToken: (signal: AbortSignal) => string | Promise<string>;
}) {
  const transport = useMemo(() => ({ fetch: createDpopFetch({ keyPair, getAccessToken, origin }) }),
    [keyPair, getAccessToken, origin]);
  const [view, setView] = useState<{ accountId: string; messages: Record<string, string> }>({ accountId, messages: {} });
  const messages = view.accountId === accountId ? view.messages : {};
  return <SseRelayProvider
    scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport}
    onEvent={(event, context) => {
      if (context.isCurrent()) setView(previous => context.isCurrent() ? {
        accountId, messages: { ...(previous.accountId === accountId ? previous.messages : {}), [event.id]: event.data },
      } : previous);
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

Exactly-once effects, persistent application state, cross-tab ownership and distributed relay storage are not provided. Your awaited handler must be idempotent and cancellation-aware. A durable checkpoint needs matching application state. One provider owns a checkpoint scope; do not run independent providers against the same scope/store. The Node example verifies signed DPoP proofs and token/key binding, but its arbitrary-account login and in-memory log are synthetic fixtures, not production OAuth or storage.

MIT licensed. See [LICENSE](LICENSE).

</details>

<details name="readme-language" open>
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-ru-dark.svg"><img src="assets/lang-ru-light.svg" width="42" height="26" alt="RU"></picture></summary>

0.1.0 · [Руководство](docs/v0.1.0/guide.ru.md) · [API 0.1.0](docs/v0.1.0/reference.ru.md) · [Версии](docs/index.md)

Управление SSE-подключением в React: один provider, обработчик события и компонент статуса. Replay, checkpoint, аутентификация и проверка протокола остаются в browser-sse-relay.

**Исходники и примеры 0.1.0 доступны в этом репозитории. Публикация npm пока не выполнена; руководство описывает локальную установку.**

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/recovery.png">
  <img src="docs/assets/recovery.gif" width="800" height="760" alt="Настоящее SSE-демо: обрыв, переподключение, потеря истории и восстановление снимком">
</picture>

[Статичный кадр](docs/assets/recovery.png) · [Визуальное руководство](docs/visual.ru.md) · [Минимальное подключение](#минимальное-подключение)

Запись настоящего локального демо с синтетическими аккаунтами. Потерянная история восстанавливается снимком, а не повторной доставкой удалённых событий. Интерфейс записи английский; русское руководство объясняет каждое действие.

| Публичный API | Визуальная интеграция |
|---|---|
| SseRelayProvider | [Дочерняя панель и аккаунты](docs/visual.ru.md#sserelayprovider) |
| SseConnectionStatus | [Подключение и восстановление](docs/visual.ru.md#sseconnectionstatus) |
| useSseRelay | [Действия](docs/visual.ru.md#usesserelay) |
| Activity · необязательно, React 19.2+ | [Скрытие и показ](docs/visual.ru.md#activity--react-192) |

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

Dev-демо использует React 19.3.1; необязательный Activity hide/show требует React 19.2+. Библиотека и минимальный пример сохраняют совместимость с React 18.3.

Откройте напечатанный loopback URL. Создайте уведомление, оборвите соединение, исчерпайте историю и восстановите снимок. [Пример уведомлений](examples/notifications/main.tsx) и [reference server](examples/notifications/server.mjs) — исполняемые исходники, а не отдельный сайт документации.

## Минимальное подключение

Endpoint должен поддерживать browser-sse-relay protocol v1. Передайте DPoP-ключ приложения и стабильный getAccessToken, возвращающий привязанный к этому ключу OAuth token. Transport подписывает каждый GET/reconnect и обрабатывает один nonce challenge. accountId берётся из проверенной OAuth-сессии и соответствует токену. Scope обозначает аккаунт и поток, но не заменяет auth. [DPoP и срок жизни сессии](docs/v0.1.0/guide.ru.md#dpop-session-ownership).

```tsx
import { useMemo, useState } from 'react';
import { createDpopFetch } from '@59alex/browser-sse-relay';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Notifications({ accountId, keyPair, getAccessToken, origin }: {
  accountId: string; keyPair: CryptoKeyPair; origin: string;
  getAccessToken: (signal: AbortSignal) => string | Promise<string>;
}) {
  const transport = useMemo(() => ({ fetch: createDpopFetch({ keyPair, getAccessToken, origin }) }),
    [keyPair, getAccessToken, origin]);
  const [view, setView] = useState<{ accountId: string; messages: Record<string, string> }>({ accountId, messages: {} });
  const messages = view.accountId === accountId ? view.messages : {};
  return <SseRelayProvider
    scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport}
    onEvent={(event, context) => {
      if (context.isCurrent()) setView(previous => context.isCurrent() ? {
        accountId, messages: { ...(previous.accountId === accountId ? previous.messages : {}), [event.id]: event.data },
      } : previous);
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

Библиотека не предоставляет exactly-once эффекты, постоянное состояние приложения, владение между вкладками и распределённое хранилище relay. Awaited-обработчик должен учитывать отмену и повторы. Постоянному checkpoint соответствует состояние приложения. Один provider владеет scope; независимые providers не должны использовать один scope/store. Node-пример проверяет DPoP-подписи и привязку token/key, но его login с выбором аккаунта и журнал в памяти — synthetic fixtures, не production OAuth или хранилище.

Лицензия MIT: [LICENSE](LICENSE).

</details>
