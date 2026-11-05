# Develop and run examples / Разработка и запуск примеров

[← README](README.md) · [Verification](docs/VERIFICATION.md)

These commands build the library checkout and its local fixtures; they are not application integration instructions. Keep the core checkout beside this repository for bootstrap. Node 22.12+ is required.

Команды собирают исходники библиотеки и локальные примеры; это не способ подключения к приложению. Для bootstrap нужен соседний checkout browser-sse-relay. Требуется Node 22.12+.

```sh
npm run bootstrap
npm test
npm run test:package
npm run test:browser
npm run demo
```

Open `/feed.html` on the printed loopback URL for the ready component. The root page shows the lower-level provider/hook API. `/api/login` is a synthetic fixture, not production OAuth.

Откройте `/feed.html` по напечатанному loopback URL для готового компонента. Корневая страница демонстрирует provider/hook. `/api/login` — синтетический fixture, а не рабочий OAuth.

```sh
npm run docs:capture:feed
npm run docs:capture
```

Captures use real Chromium requests. GIFs have PNG alternatives in the documentation.
