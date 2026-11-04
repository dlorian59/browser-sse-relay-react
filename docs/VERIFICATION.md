# Verification / Проверки

[← Documentation / Документация](index.md) · [README](../README.md)

Local verification: 2026-11-04. Node 24.21.0, TypeScript 5.9.3. The source and artifacts are local candidates; no remote CI or npm publication is claimed.

Локальная проверка: 2026-11-04. Исходники и архивы подготовлены локально; запуск удалённого CI и публикация npm не заявляются.

| Check / Проверка | Evidence / Результат |
|---|---|
| `npm test` | 8 passed: StrictMode setup/cleanup lane; account replacement waits old handler and prevents stale checkpoints; logout clear precedes replacement; snapshot cursor and committed-cursor observation; clear failure; SSR; unmount after reconnect; A→B→A memory reset. |
| `npm run test:browser` | Chromium 156.0.8078.4 + React 19.3.1: 8 scenarios passed; no page errors. Real Node HTTP reference relay, not mocked fetch. |
| `npm run test:package` | Clean installed tarball consumer + React 18.3.1: public declarations, 2 README and 4 guide snippets, idle SSR, semver base peer and retained “use client” directive. |
| TypeScript example | Notifications source typechecked separately; Vite serves the actual public package import. |
| Markdown navigation | Relative file links and local heading anchors checked; native EN/RU details retained. |

The browser scenarios cover one subscriber under StrictMode, unchanged connection on unrelated render, notification processing, reconnect, retention gap → resync, snapshot restoring seven notifications, account isolation and logout with no subscriber remaining. Test-created HTTP listeners and Chromium are closed in finally blocks.

Браузерные сценарии проверяют одну подписку в StrictMode, отсутствие переподключения при постороннем рендере, уведомление, reconnect, retention gap → resync, восстановление семи уведомлений снимком, изоляцию аккаунта и logout без оставшихся подписчиков. Свои HTTP listeners и Chromium тест закрывает в finally.

Raw local evidence is generated in ignored output/browser-smoke.json and output/package-smoke.json. Package tests use a temporary consumer and remove it after verification. The bootstrap builds the sibling base source; it does not fetch a fictitious published release. CI is configured to check out that base repository and run the same tests once remote access is available.

Сырые результаты создаются в игнорируемых output/browser-smoke.json и output/package-smoke.json. Временное приложение-потребитель удаляется после проверки. Bootstrap собирает соседний checkout базовой библиотеки. CI настроен на checkout базы и те же проверки, но сейчас удалённый запуск недоступен.

Not verified: Firefox/Safari, Next.js application runtime, production authentication, durable/distributed event storage, cross-tab ownership and multi-process snapshot consistency. React 18 was checked as an installed consumer/SSR; the interactive browser run used React 19. No exactly-once or durability claim follows from these tests.

Не проверены Firefox/Safari, приложение Next.js, production-auth, durable/distributed event storage, межвкладочное владение и согласованность снимка между процессами. React 18 проверен как установленный потребитель/SSR; интерактивный браузер использовал React 19. Проверки не доказывают exactly-once или durability.

[← Documentation / Документация](index.md) · [README](../README.md)
