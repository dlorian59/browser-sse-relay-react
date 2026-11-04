# Lifecycle / Жизненный цикл

[← Documentation / Документация](index.md) · [README](../README.md)

## English

The provider creates a pure SessionOwner without browser I/O. useSyncExternalStore reads an immutable cached snapshot; SSR reads a fixed idle snapshot. Effect setup supplies configuration, and cleanup invalidates that configuration. Actions retained after unmount cannot start another session. Account changes synchronously mask the old status/cursor in the hook before passive effects run.

Each owner has one promise lane. Replacement invalidates the old generation and aborts its base client immediately, then waits for the old start() promise to settle before constructing the next client. StrictMode setup → cleanup → setup shares this lane, so abandoned queued starts do not open transports. Logout joins that same lane and clears its captured scope/store after old handlers/checkpoint writes. A rejected clear is reported to the caller and status; it does not poison the lane.

The wrapper delegates event processing, authentication, retry, parsing and all checkpoint decisions to SseRelayClient. Its checkpoint observer waits for the delegated save, then reads the base client's committedCursor on a later task; it never acknowledges for the base client. Rapid cursor updates may coalesce in the UI. Cursor display is diagnostics, not a durable commit notification API.

The default memory store is reset on scope changes or when disabled. A supplied store keeps its own persistence policy. One provider is one owner; no global registry or cross-tab lock is added. Separate providers must not concurrently own the same checkpoint scope. Hosts coordinate full remounts and application-state lifetime. An async handler/store that never settles necessarily delays replacement; overlapping it would break ownership.

React state updates are asynchronous and not transactional with checkpoints. A domain handler must be idempotent; durable effects and durable cursor storage need a host-defined consistency model. A retained cursor plus missing state needs recovery. Stop → fetch coherent snapshot → install state → resume matching cursor is explicit in the example.

The public entry retains “use client”; only React 18.3-compatible hooks are used. This is a client boundary declaration, not a completed Next.js integration test. Stable APIs are documented by [React StrictMode](https://react.dev/reference/react/StrictMode) and [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).

For React 19.2+ Activity, keep this provider and its domain view state inside the same boundary: hidden effects release the transport, visible effects resume against the retained state/checkpoint. The [runnable example and limits](v0.1.0/reference.en.md#optional-react-192-activity-example) are separate from the React 18 minimum.

## Русский

Provider создаёт SessionOwner без браузерного I/O. useSyncExternalStore получает неизменяемый кешированный snapshot; SSR — фиксированное idle-состояние. Effect передаёт конфигурацию, cleanup делает её неактуальной. Действия, сохранённые после unmount, не начинают новую сессию. При смене аккаунта hook синхронно скрывает прежние статус/курсор ещё до passive effects.

У владельца одна очередь promise. Замена сразу инвалидирует поколение и отменяет старый base client, затем ждёт завершения его start() до создания нового. StrictMode setup → cleanup → setup использует эту же очередь: отменённый queued start не открывает transport. Logout ожидает старые handlers/checkpoint writes и очищает захваченные scope/store. Ошибка clear возвращается вызывающему коду и отображается в статусе, не ломая дальнейшую очередь.

Обработка, auth, retry, parser и подтверждение checkpoint делегируются SseRelayClient. Observer ждёт save, затем читает committedCursor базового клиента в следующей задаче; сам события не подтверждает. Быстрые обновления курсора могут объединяться в UI. Отображаемый курсор — диагностика, не API уведомлений о durable commit.

Стандартный memory store сбрасывается при смене scope или отключении provider. Переданный store сохраняет собственную политику persistence. Один provider — один владелец; глобального registry или межвкладочной блокировки нет. Разные providers не должны одновременно владеть одним checkpoint scope. Приложение согласует remount и срок жизни своего состояния. Незавершающийся handler/store задерживает замену; параллельный запуск нарушил бы владение.

React state меняется асинхронно и не образует транзакцию с checkpoint. Обработчик должен быть идемпотентным; согласованность durable-эффектов и cursor storage задаёт приложение. Сохранённый курсор при потерянном состоянии требует recovery. Пример явно выполняет stop → согласованный снимок → применение состояния → resume соответствующего курсора.

Entry сохраняет «use client»; используются hooks, доступные в React 18.3. Это объявление client boundary, не выполненная интеграционная проверка Next.js. Официальные описания API: [React StrictMode](https://react.dev/reference/react/StrictMode), [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).

Для React 19.2+ Activity provider и бизнес-состояние размещаются внутри одной границы: hidden очищает transport effects, visible продолжает с сохранёнными состоянием/checkpoint. [Пример и ограничения](v0.1.0/reference.ru.md#отдельный-пример-activity-для-react-192) не повышают минимум React 18.

[← Documentation / Документация](index.md) · [README](../README.md)
