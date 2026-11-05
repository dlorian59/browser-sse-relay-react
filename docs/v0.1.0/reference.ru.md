# Справочник React API · 0.1.0 · Русский

[← Документация](../index.md) · [Руководство](guide.ru.md) · [English](reference.en.md) · [README](../../README.md)

Runtime exports: SseRelayProvider, useSseRelay, SseConnectionStatus. Типы: SseRelayProviderProps, SseRelayValue, SseConnectionStatusProps, RelayActions, RelaySnapshot, RelayTransportOptions. SessionOwner/SessionConfig — внутренние детали, не exports пакета. [Public source](https://github.com/dlorian59/browser-sse-relay-react/blob/main/src/index.tsx), [жизненный цикл](https://github.com/dlorian59/browser-sse-relay-react/blob/main/src/session.ts).

## Props provider и идентичность

| Prop | Значение / контракт |
|---|---|
| scope | Обязательный StreamScope либо null. Идентичность задают accountId/streamId; новый объект с прежними значениями не переподключает поток. null отключает. Auth остаётся серверной. |
| url | Обязательный RelayOptions.url: строка или sync/async context callback. URL-функцию мемоизируют; смена ссылки заменяет сессию. |
| onEvent | Обязательный awaited RelayOptions.onEvent; можно inline. Новый callback устанавливается эффектом без замены transport. Уже начатая async-функция продолжает прежнее тело и должна учитывать отмену. |
| checkpoint | Необязательный CheckpointStore. По умолчанию MemoryCheckpointStore provider, сбрасываемый при смене scope/отключении. Пользовательский store мемоизируют; смена ссылки заменяет подключение. |
| transport | Необязательный RelayTransportOptions с defaults базы. Мемоизируйте объект, чтобы не заменять сессию каждым render. |
| enabled | true; false отключает подключение и сбрасывает default memory checkpoint. Для паузы с сохранением cursor используйте stop(). |
| children | Необязательный ReactNode. Потомки читают эту сессию; вложенный provider создаёт независимую. |

Default checkpoint и view state должны жить одинаково. Переданный durable store сохраняет собственную политику; wrapper не удаляет все scopes при смене аккаунта. Одинаковый scope у разных providers/вкладок требует внешней координации. Сохранённые actions не запускают transport после cleanup/unmount; новые эффекты могут настроить следующую сессию. Смена аккаунта синхронно скрывает старый snapshot при render; отключение очищает также terminal diagnostic и attempt.

RelayTransportOptions исключает scope/url/onEvent/checkpoint/onState/initialCursor. Используйте props, resume() и наблюдение через hook. [Базовый API и defaults](https://github.com/dlorian59/browser-sse-relay/blob/main/docs/v0.1.0/reference.ru.md).

| transport | Унаследованное значение / назначение |
|---|---|
| headers | Не задано; HeadersInit/context callback на каждую попытку; Accept/Last-Event-ID задаёт библиотека. |
| credentials | same-origin. |
| signal | Не задано; внешняя отмена останавливает run. Reconnect с уже отменённым signal тоже остановится. |
| refreshAuth | Не задано; sync/async boolean после 401, в рамках retry budget. |
| fetch | globalThis.fetch либо совместимая реализация. |
| connectTimeoutMs / idleTimeoutMs | 10000 /45000; ожидание headers / входящих байтов, не deadline обработчика. |
| retry | maxAttempts=8, minDelayMs=250, maxDelayMs=10000, jitter=0.2; общее число подключений. |
| limits | maxFrameBytes=65536, maxQueuedEvents=128, maxQueuedBytes=1048576, dedupEntries=1024. |
| random | Math.random; sample для jitter. |

## Hook и действия

`useSseRelay(): SseRelayValue` бросает ошибку вне provider. Читает ближайший provider, не создаёт transport. Функции действий стабильны, но объединённый объект результата не обещан стабильным. В dependencies эффектов используйте отдельные values/actions, не весь объект.

| RelaySnapshot | Начальное / смысл |
|---|---|
| state | idle; RelayState базовой библиотеки. |
| scope | Изначально/при отключении null; иначе замороженные account/stream. |
| cursor | Изначально undefined; наблюдаемый committed cursor. UI может объединять уведомления; это не durable commit callback. |
| attempt | Изначально 0; номер подключения текущей базовой сессии. |
| pending | Изначально false; true, пока старт/stop/logout ждёт прежнюю работу. Не счётчик pending бизнес-событий. |
| result | Изначально undefined; terminal RelayResult. Новый run/disabled сбрасывает. stop() может сохранить прежнюю диагностику до нового run; учитывайте state. |

| RelayActions | Результат и граница |
|---|---|
| stop() | Promise<void>: инвалидировать generation, отменить transport, дождаться обработки/checkpoint. Config/cursor сохраняются для reconnect. |
| reconnect() | void: поставить замену после старой работы, загрузить checkpoint, создать новый one-shot client/retry budget. Состояние приложения не восстанавливает. |
| resume(cursor) | void: заменить сессию с курсором уже установленного состояния. Ошибки validation/setup появляются в result, не в awaited return. |
| logout() | Promise<void>: stop/wait/clear захваченного scope/store. Clear error отклоняет promise и даёт failed/logout-failed. Credentials не отзывает и scope=null автоматически не задаёт. |

reconnect/resume ничего не делают без активной конфигурации: disabled/null scope/unmounted. Очередь действует внутри provider, не между независимыми владельцами. Handler/store без завершения блокирует замену; конкурентный writer вместо этого не запускается.

## Статусы, ошибки и доступность

| State | Подпись по умолчанию |
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

Protocol/auth/retry/resync details — базовый RelayResult. Wrapper добавляет configuration-failed для constructor/setup и logout-failed при clear error. Error имеет тип unknown; проверяйте безопасно, не выводите credentials или произвольные сообщения. [Практическая диагностика](guide.ru.md#диагностика-и-ограничения).

SseConnectionStatusProps расширяет HTML-атрибуты div, заменяя native children. labels — partial map state→string, отсутствующие значения используют английскую таблицу. children — `(value:SseRelayValue) => ReactNode`, render callback имеет приоритет над labels и получает hook value/actions. className/style/id и остальные div props передаются дальше. По умолчанию role=status, aria-live=polite, aria-atomic=true; их можно переопределить, тогда доступность обеспечивает приложение. data-state/aria-busy управляются компонентом. Нет обязательных CSS/icons, автоматического показа ошибок, snapshot fetch или кнопки retry.

```tsx
import { SseConnectionStatus } from '@59alex/browser-sse-relay-react';
export function TranslatedStatus() {
  return <SseConnectionStatus labels={{ live: 'Подключено', resync: 'Нужен снимок', closed: 'Остановлено' }}
    className="connection-status" />;
}
```

Разместите внутри provider. [Работающие recovery controls](../../examples/notifications/main.tsx) показывают проверку снимка и обработку ошибок приложения; подтверждение событий остаётся в базовом протоколе.

## React 18 baseline и актуальные возможности

Библиотека использует context/ref/effect/useSyncExternalStore, доступные React 18. Store предоставляет стабильные subscribe/getSnapshot, неизменяемый cached snapshot и фиксированный idle getServerSnapshot. SSR/hydration не запускает сеть. Entry сохраняет «use client»; callbacks/stores передаются из client component приложения. Сам Next.js интеграционно не проверен.

Ref onEvent обновляется эффектом, не render-записью: отменённый concurrent render не заменяет callback. Новая функция доступна после этого эффекта, не синхронно во время render. Изменение onEvent не перезапускает SSE. useEffectEvent не используется как public callback и не передаётся другому component/hook: официальный API ограничивает эти сценарии. Это также сохраняет React 18. [External store](https://react.dev/reference/react/useSyncExternalStore), [ограничения Effect Event](https://react.dev/reference/react/useEffectEvent), [актуальные версии](https://react.dev/versions).

### Отдельный пример Activity для React 19.2+

Source demo работает с React 19.3.1 и [Activity](https://react.dev/reference/react/Activity). ActivityExample в [main.tsx](../../examples/notifications/main.tsx) оборачивает App: provider и его notification state находятся внутри одной границы. Hide dashboard очищает transport effects, сохраняя состояние; Show dashboard создаёт эффекты снова и продолжает с сохранённого cursor. Здесь не вызывается enabled=false, который намеренно сбрасывает default checkpoint.

Запустите `npm run demo`: создайте уведомления, скройте панель и верните её. Browser test дополнительно публикует событие сервером во время скрытия: subscriptions становится 0, после показа существует одна подписка, а сохранённые семь уведомлений дополняются пропущенным. Если retention истёк во время скрытия, при показе будет resync и потребуется снимок. Activity не ставит сеть на паузу глобально: если provider оставить снаружи, а скрыть только визуального потомка, подписка останется. Это также не logout, persistence или reload recovery. Удаление/unmount границы уничтожает её состояние.

React 18 использует обычный provider-пример README без импорта Activity. Минимальная зависимость остаётся React 18.3. [Проверяемый сценарий](../../scripts/browser-smoke.mjs), [результаты](../VERIFICATION.md).

[← Документация](../index.md) · [Руководство](guide.ru.md) · [English](reference.en.md)
