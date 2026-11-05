# Панель уведомлений · 0.1.0 · Русский

[← Документация](../index.md) · [README](../../README.md) · [English](guide.en.md)

[Полный API и значения по умолчанию](reference.ru.md)

[Visual integrations / Визуальные интеграции](../visual.ru.md)

## Задача и результат

Панель заказов получает уведомления для вошедшего пользователя. Разрыв сети не должен создавать вторую подписку. Если история уже удалена, интерфейс сообщает о необходимости снимка. При смене аккаунта старые уведомления и курсор не должны попасть в новое представление.

Исполняемый пример соединяет React StrictMode с настоящим HTTP relay на Node. В журнале намеренно остаётся только три события, поэтому потерю истории легко воспроизвести. После восстановления снимком панель показывает семь уведомлений: они получены из состояния сервера, а не восстановлены из просроченного курсора.

## Конфигурация и запуск

Расположите исходники browser-sse-relay и browser-sse-relay-react в соседних каталогах. Пакеты ещё не опубликованы. Для разработки нужен Node 22.12+; локальная проверка выполнена на Node 24.21.0.

```bash
npm run bootstrap
npm test
npm run demo
```

Если базовая библиотека находится в другом месте: `SSE_RELAY_SOURCE=/absolute/path/browser-sse-relay npm run bootstrap`. Скрипт собирает её архив в output/ и устанавливает вместе с зависимостями разработки React/Vite. Semver peer в package.json не заменяется локальным file-путём. Прямые версии dev-зависимостей зафиксированы; воспроизводимость транзитивного дерева через lockfile для этого bootstrap не заявляется.

Откройте напечатанный loopback URL. Окно рабочего стола автоматически не открывается. Vite и HTTP API используют один origin. Синтетический /api/login выдаёт непрозрачный DPoP-bound token для alice/bob и переданного thumbprint ключа. Каждый защищённый запрос проверяет подпись, method/URL, token hash, token/key binding, время, nonce и replay. Локальный выбор аккаунта не является OAuth или проверкой личности.

## Где находится код

| Исходник | За что отвечает |
|---|---|
| [main.tsx](../../examples/notifications/main.tsx) | Provider, scope аккаунта, проверка и upsert уведомлений, статус, выход и восстановление снимком. |
| [server.mjs](../../examples/notifications/server.mjs) | Reference relay, состояние по аккаунтам, согласованное синхронное чтение снимка и курсора, истечение истории. |
| [browser-smoke.mjs](../../scripts/browser-smoke.mjs) | Проверка жизненного цикла и восстановления в настоящем браузере. |

Комментарии в примерах идут на английском, затем на русском. Журнал и данные сервера хранятся в памяти одного процесса. Production-снимок требует согласованности в реальном хранилище; нельзя переносить предположение об одном event loop на распределённую систему.

## Один provider и одна подписка

Полный минимальный компонент приведён в [README](../../README.md). Передайте scope, URL и onEvent; provider управляет подключением и checkpoint в памяти. В потомках `useSseRelay()` возвращает статус, scope, подтверждённый курсор, попытку, ожидание завершения, терминальный результат и действия.

Inline onEvent поддерживается. Scope сравнивается по accountId и streamId. Мемоизируйте transport, пользовательский checkpoint store и URL-функцию: новая ссылка заменяет подключение. Замена только onEvent не переподключает поток. В приложении с React Server Components callbacks и store передаются из client component; entry пакета сохраняет директиву «use client». SSR возвращает idle без fetch.

```tsx
import { useMemo } from 'react';
import { createDpopFetch } from '@59alex/browser-sse-relay';
import { SseRelayProvider, SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function AuthenticatedStream({ accountId, keyPair, getAccessToken, origin }: {
  accountId: string; keyPair: CryptoKeyPair; origin: string;
  getAccessToken: (signal: AbortSignal) => string | Promise<string>;
}) {
  const transport = useMemo(() => ({
    fetch: createDpopFetch({ keyPair, getAccessToken, origin }),
    retry: { maxAttempts: 8, minDelayMs: 300, maxDelayMs: 3000 },
  }), [keyPair, getAccessToken, origin]);
  return <SseRelayProvider scope={{ accountId, streamId: 'notifications' }}
    url="/api/events" transport={transport} onEvent={event => { console.log(event.data); }}>
    <SseConnectionStatus />
  </SseRelayProvider>;
}
```

Результат: каждый GET/reconnect получает актуальный привязанный токен и новый proof; один nonce challenge повторяется внутри fetch adapter. Сохраняйте стабильные keyPair, origin и getAccessToken; их смена заменяет transport после завершения старой работы. transport.refreshAuth остаётся отдельным token-refresh hook, не nonce handshake. Постоянные Authorization/DPoP headers и переданный accountId не заменяют auth; fallback-схемы нет.

<a id="dpop-session-ownership"></a>
## Владение DPoP-сессией

OAuth выполняет приложение: createDpopKeyPair() создаёт P-256 пару с nonextractable private key; getDpopThumbprint(keyPair) даёт публичный thumbprint для привязки; authorization flow получает токен, связанный с этим ключом. Ключ сохраняется, пока используется его token. createDpopFetch({keyPair,getAccessToken,origin}) — GET-only transport: новый proof, ограничение точным origin, запрет redirect и один nonce retry. Мемоизируйте transport.fetch. Generic headers остаются для прочих метаданных; proof нельзя заранее вычислить и переиспользовать.

[Руководство DPoP ядра](https://github.com/dlorian59/browser-sse-relay/blob/main/docs/dpop.ru.md) · [Типизированная React-интеграция](../../examples/notifications/integration.tsx) · [Synthetic session](../../examples/notifications/auth.ts) · [Проверяющий fixture](../../examples/notifications/dpop-auth.mjs).

В demo login любой локальный пользователь выбирает alice/bob: реальная личность не подтверждается. Fixture проверяет ES256, htm/htu, ath, cnf.jkt, время, nonce и одноразовый jti с ограниченным состоянием; другие auth-схемы отклоняются. Скопированный verifier под MIT — пример, не public export и не production identity provider. URL proof формируется из доверенного loopback origin, не Host header. Истечение token закрывает уже открытый demo SSE. Production требует HTTPS, проверки issuer/audience/token, политики ключей и replay/nonce storage под свою архитектуру.

Activity hide/show сохраняет те же key/token. При смене аккаунта ожидается relay.logout(), очищается представление и создаётся отдельная bound session. Logout удаляет локальную UI identity; серверный отзыв credentials выполняет OAuth-интеграция. getAccessToken запрашивает у SDK действующий token, при необходимости заранее обновляя его с тем же bound key. NotificationScope принимает также refreshAuth для обычного HTTP401: вернуть true можно после обновления токена SDK. В демо намеренно нет OAuth refresh: токены истекают через пять минут. Требуется secure-context Web Crypto: HTTPS либо localhost для демо.

Fixture POST publish/drop/expire без тела использует createDpopProof напрямую. Повторяется только первый nonce challenge, поскольку verify предшествует любой мутации. Это не универсальный POST replay transport: GET adapter не расширяется до повторов произвольных body.

## Статус и элементы восстановления

`SseConnectionStatus` предоставляет polite atomic live region и data-state, без CSS-зависимости. Можно перевести labels или передать render callback. Восстановление состояния остаётся явным действием приложения.

```tsx
import { SseConnectionStatus } from '@59alex/browser-sse-relay-react';

export function Connection({ restoreSnapshot }: { restoreSnapshot: () => Promise<void> }) {
  return <SseConnectionStatus labels={{ idle: 'Ожидание', live: 'Подключено', resync: 'Нужен снимок' }}>
    {relay => <>
      <span>{relay.state === 'resync' ? 'Нужен снимок' : relay.state}</span>
      {relay.state === 'resync' && <button disabled={relay.pending}
        onClick={() => void restoreSnapshot()}>Восстановить уведомления</button>}
    </>}
  </SseConnectionStatus>;
}
```

Компонент размещается внутри provider. Callback restoreSnapshot обрабатывает ошибки и повторные клики, как Dashboard в исполняемом примере. Render callback заменяет текст labels; для обычных переведённых подписей не передавайте children. Подробности ошибки доступны в relay.result; серверные сообщения автоматически не выводятся.

## Replay, снимок и состояние приложения

1. Publish notification: проверенное уведомление добавляется через upsert по бизнес-ключу. Повторная доставка не дублирует этот элемент.
2. Disconnect: relay закрывает сокет; клиент продолжает с подтверждённого курсора.
3. Create retention gap: поток останавливается, сервер создаёт шесть уведомлений, сохраняя три события журнала, затем клиент переподключается. Получаем resync вместо ложного live.
4. Restore snapshot: дождаться остановки старой обработки; получить `{ scope, items, cursor }`; проверить данные и актуальность ответа; установить items; вызвать `resume(cursor)`. В списке семь уведомлений.

Полная последовательность — в [recover](../../examples/notifications/main.tsx). `resume` не получает и не применяет состояние. Курсор снимка должен точно соответствовать состоянию, установленному приложением. Reference server читает оба значения синхронно без await; production-сервер обязан обеспечить эквивалентную согласованность.

Checkpoint по умолчанию хранится в памяти и сбрасывается при смене scope, включая A → B → A, а также при отключении provider. Для паузы с сохранением курсора используйте stop(). Состояние представления должно жить в течение того же provider/scope. Если состояние очищено, а provider остался, остановите поток и примените снимок перед продолжением. Новый provider без курсора может получить только ещё сохранённую историю; он не знает о более ранних потерянных бизнес-данных. Если origin удалён, reference server возвращает resync, не воспроизводит молча частичный журнал. Полной панели нужен начальный снимок, когда retained history недостаточно.

Пользовательский постоянный checkpoint намеренно переживает смену аккаунта и remount. Это только позиция, не состояние приложения. Восстанавливайте их согласованно либо получите свежий снимок до включения provider. Нельзя загрузить сохранённый курсор в пустое представление и считать, что replay восстановит всё.

## Остановка, смена аккаунта и выход

| Действие | Поведение |
|---|---|
| `await stop()` | Отменить transport, дождаться обработчика/checkpoint; сохранить курсор для прежнего состояния. |
| `reconnect()` | Заменить сессию и загрузить checkpoint после завершения предыдущей работы. |
| `resume(cursor)` | Заменить сессию с курсором уже установленного состояния. |
| `await logout()` | Остановить поток, дождаться работы, удалить checkpoint текущего scope. Ошибка clear отклоняет promise и отражается в статусе. |
| `scope={null}` / `enabled={false}` | Остановить подключение и сбросить стандартный memory store; серверную auth-сессию это не завершает. |

Демо ждёт logout, очищает представление, затем меняет аккаунт. Ошибка clear не выдаётся за успешный выход. Не запускайте независимый provider для того же checkpoint scope до завершения очистки. React не умеет ожидать асинхронную effect cleanup: сохраняйте один provider при смене аккаунта либо координируйте remount на уровне приложения. Очередь библиотеки действует внутри provider, не между вкладками или независимыми providers.

Асинхронный обработчик проверяет context.signal/context.isCurrent() перед поздним эффектом и своевременно завершается при отмене. Незавершаемый обработчик/store задерживает teardown: библиотека не создаёт конкурирующего владельца checkpoint. Уже выполненный эффект не откатывается. Сохранённые reconnect/resume после unmount не запускают подключение.

## Необязательный Activity: сохранить скрытую панель

Демо использует React 19.3.1. Кнопки Hide dashboard / Show dashboard показывают Activity (React 19.2+): notification state и provider остаются внутри границы, а cleanup эффектов закрывает SSE. При показе события replay дополняют сохранённое состояние. Если история успела истечь, нужен обычный snapshot recovery. Это отличается от enabled=false, сбрасывающего стандартный checkpoint. Для React18 остаётся обычный provider-пример без Activity. [Жизненный цикл и исходник](reference.ru.md#отдельный-пример-activity-для-react-192).

## Проверки и установка архивов

```bash
npm run test:browser
npm run test:package
```

Для browser-проверки нужен Playwright Chromium (`npx playwright install chromium`, если отсутствует). Package-проверка устанавливает оба архива в чистое приложение с React 18.3.1, компилирует примеры README/руководств и выполняет SSR. Настоящий браузер использует React 19.3.1. Подробности: [проверки](../VERIFICATION.md).

Полученные архивы можно вместе установить в приложение с поддерживаемым React. Это локальная проверка артефактов, не публикация npm. Для запуска dev-демо нужны исходники и dev-зависимости Vite.

## Диагностика и ограничения

| Симптом | Причина и действие |
|---|---|
| Подключение меняется при рендерах | Мемоизировать transport/store/URL-функцию; сохранить provider. |
| resync | Курсор просрочен, история потеряна или превышена очередь. Получить согласованные состояние/курсор, не пропускать пробел вслепую. |
| closed и pending=true | Handler/checkpoint ещё завершается. Обработать отмену и завершить promise. |
| Пустая панель после reload | Курсор сохранился, а состояние — нет. Получить снимок. |
| configuration-failed | Проверить terminal error и валидацию URL/scope/options базового клиента. |
| logout-failed | Clear завершился ошибкой. Обработать rejected promise до изменения аккаунта. |
| Обычный SSE endpoint не работает | Нужен browser-sse-relay protocol v1, а не произвольный EventSource-сервер. |

Не предоставляются exactly-once эффекты, глобальная блокировка владения, durable relay, прикладная схема, auth provider или начальный бизнес-снимок. Порядок handler → checkpoint → cursor сохранён; ошибка checkpoint может повторить эффект. React state в примере не является durable commit. Firefox/Safari и приложение Next.js для этой обёртки не запускались; широкая матрица браузеров и фреймворков не заявляется.

[← Документация](../index.md) · [README](../../README.md) · [English](guide.en.md)
