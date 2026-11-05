# Verification / Проверки

[← Documentation / Документация](index.md) · [README](../README.md)

Local verification: 2026-11-05. Node 24.21.0, TypeScript 5.9.3. The source and artifacts are local candidates; no remote CI or npm publication is claimed.

Локальная проверка: 2026-11-05. Исходники и архивы подготовлены локально; запуск удалённого CI и публикация npm не заявляются.

| Check / Проверка | Evidence / Результат |
|---|---|
| `npm test` | 9 passed: StrictMode setup/cleanup lane; account replacement waits old handler and prevents stale checkpoints; logout clear precedes replacement; snapshot cursor and committed-cursor observation; clear failure; SSR; unmount after reconnect; A→B→A memory reset; disabled-account diagnostic isolation. |
| `npm run test:browser` | Chromium 156.0.8078.4 + React 19.3.1: 9 scenarios passed; no page errors. Real Node HTTP reference relay, not mocked fetch. |
| `npm run test:package` | Clean installed tarball consumer + React 18.3.1: public declarations, 2 README, 4 guide and 2 reference snippets, idle SSR, semver base peer and retained “use client” directive. |
| TypeScript example | Notifications source typechecked separately; Vite serves the actual public package import. |
| Markdown navigation | Relative file links and local heading anchors checked; native EN/RU details retained. |

The browser scenarios cover one subscriber under StrictMode, unchanged connection on unrelated render, notification processing, reconnect, retention gap → resync, snapshot restoring seven notifications, Activity hide/show with retained state and replay, account isolation and logout with no subscriber remaining. Test-created HTTP listeners and Chromium are closed in finally blocks.

Браузерные сценарии проверяют одну подписку в StrictMode, отсутствие переподключения при постороннем рендере, уведомление, reconnect, retention gap → resync, восстановление семи уведомлений снимком, Activity hide/show с сохранением состояния и replay, изоляцию аккаунта и logout без оставшихся подписчиков. Свои HTTP listeners и Chromium тест закрывает в finally.

Raw local evidence is generated in ignored output/browser-smoke.json and output/package-smoke.json. Package tests use a temporary consumer and remove it after verification. The bootstrap builds the sibling base source; it does not fetch a fictitious published release. CI is configured to check out that base repository and run the same tests once remote access is available.

Сырые результаты создаются в игнорируемых output/browser-smoke.json и output/package-smoke.json. Временное приложение-потребитель удаляется после проверки. Bootstrap собирает соседний checkout базовой библиотеки. CI настроен на checkout базы и те же проверки, но сейчас удалённый запуск недоступен.

Not verified: Firefox/Safari, Next.js application runtime, production authentication, durable/distributed event storage, cross-tab ownership and multi-process snapshot consistency. React 18 was checked as an installed consumer/SSR; the interactive browser run used React 19. No exactly-once or durability claim follows from these tests.

Не проверены Firefox/Safari, приложение Next.js, production-auth, durable/distributed event storage, межвкладочное владение и согласованность снимка между процессами. React 18 проверен как установленный потребитель/SSR; интерактивный браузер использовал React 19. Проверки не доказывают exactly-once или durability.

[← Documentation / Документация](index.md) · [README](../README.md)

## Visual guide capture · 2026-11-05

All three public runtime exports are covered: provider → provider.gif, status → recovery.gif, hook actions → shared recovery.gif plus provider.gif for logout. React Activity (not a library export) → activity.gif. Assets are actual headless Chromium 156.0.8078.4 recordings of the Node loopback fixture and React 19.3.1, at 800×760. The capture script verifies account isolation, notification counts, reconnect attempts, resync, seven-item snapshot restoration, zero hidden subscribers, one resumed subscriber and replayed hidden publication. No page errors. GIF sizes: provider 1,412,340 bytes; recovery 1,597,208; Activity 1,229,032. Three PNG fallbacks; no binary duplicates.

Покрыты все три runtime exports: provider → provider.gif; статус → recovery.gif; hook actions используют тот же recovery.gif и provider.gif для logout. React Activity — отдельный сценарий activity.gif, не export библиотеки. Настоящий Chromium/Node fixture проверяет аккаунты, количество уведомлений, reconnect, resync, восстановление семи элементов снимком, отсутствие скрытых подписчиков и replay после показа. PNG дают статичный/reduced-motion вариант; бинарных дублей нет.

`npm run docs:capture` uses only port 5183 and closes its fixture and headless browser. Capture injects a 650 ms request-forwarding delay and enables the clearly labeled 250 ms demo handler delay for legibility. No UI state or protocol payload is forged. Raw videos and evidence are ignored under output/visual-sse/. Run source is scripts/capture-docs.mjs. Subsequent existing browser suite: 9 scenarios passed. New integration source and the main demo typecheck; clean React18.3.1 consumer compiles six additional visual-guide snippets alongside the eight existing snippets. Runtime API is unchanged.

`npm run docs:capture` использует только порт 5183 и закрывает свои процессы. Задержки для читаемости явно описаны; состояние UI и protocol payload не подменяются. Исходник записи — scripts/capture-docs.mjs. Существующие 9 browser-сценариев прошли; интеграционные примеры компилируются, установленный пакет с React18.3.1 проверяет шесть новых visual snippets и восемь прежних. Runtime API не менялся.
