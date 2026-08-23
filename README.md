# Money Tracker

Петпроєкт для обліку особистих витрат і місячних бюджетів. Реалізовано реєстрацію, вхід, серверні сесії та захист приватної частини застосунку.

## Стек

- npm workspaces і Turborepo;
- Next.js, React і MUI для web;
- NestJS REST API;
- TypeScript і Zod для спільних контрактів;
- PostgreSQL у Docker Compose;
- Vitest для базових тестів.

## Вимоги

- Node.js 22.13 або новіший;
- npm 10 або новіший;
- Docker із Docker Compose — для локальної бази даних і Grafana Alloy.

## Швидкий старт

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run dev
```

Якщо використовується NVM, перед запуском виконайте `nvm use`: API потребує Node.js 22.13 або новішої версії, а рекомендована версія записана в `.nvmrc`.

Після запуску доступні:

- web: [http://localhost:3000](http://localhost:3000);
- API health check: [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health);
- PostgreSQL: `localhost:5432`.
- Grafana Alloy UI: [http://localhost:12346](http://localhost:12346).

Web звертається до API через same-origin `/api`, який Next.js проксіює до NestJS. Сесія зберігається в PostgreSQL, а браузер отримує лише `HttpOnly` cookie.

## Логи

Лише API записує error-логи у форматі NDJSON до `logs/api.log`. Шлях можна змінити через `LOG_FILE`; відносний шлях завжди рахується від кореня проєкту. Для неочікуваної помилки записуються детальна подія `request.failed` і canonical line `http.request.completed`, пов'язані спільним `trace_id`. Успішні запити, warning, info і debug у файл не записуються. Web proxy не створює власних логів, але передає `X-Trace-Id` у бекенд.

```bash
tail -f logs/api.log
```

Grafana Alloy читає `logs/api.log`, розбирає NDJSON і надсилає записи до Loki. Alloy запускається окремо:

```bash
npm run alloy:up
```

За замовчуванням використовується Loki на хості за адресою `http://localhost:3101`; із Docker-контейнера він доступний як `http://host.docker.internal:3101/loki/api/v1/push`. Повний push URL можна змінити через `LOKI_URL` у `.env`:

```dotenv
LOKI_URL=http://host.docker.internal:3101/loki/api/v1/push
LOKI_TENANT_ID=tenant1
```

Детальна конфігурація та перевірка описані в [`docs/15-observability.md`](./docs/15-observability.md).

## Структура

```text
apps/
  web/       Next.js застосунок, auth UI і приватні маршрути
  api/       NestJS API, PostgreSQL-репозиторії та міграції
packages/
  shared/    Zod-схеми, derived types, enum-и та константи
docs/        вимоги, специфікації та дизайн
```

Внутрішні залежності імпортуються через workspace scope `@money-tracker/*`. Alias `@/` вказує на `src` відповідного застосунку.

## Команди

| Команда                | Призначення                         |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Запустити web та API в watch-режимі |
| `npm run dev:web`      | Запустити лише web                  |
| `npm run dev:api`      | Запустити лише API                  |
| `npm run build`        | Зібрати всі пакети                  |
| `npm run lint`         | Перевірити ESLint                   |
| `npm run typecheck`    | Перевірити TypeScript               |
| `npm run test`         | Запустити тести                     |
| `npm run format:check` | Перевірити форматування             |
| `npm run db:up`        | Запустити PostgreSQL                |
| `npm run db:down`      | Зупинити PostgreSQL                 |
| `npm run db:migrate`   | Застосувати міграції PostgreSQL     |
| `npm run alloy:up`     | Запустити Grafana Alloy             |
| `npm run alloy:down`   | Зупинити Grafana Alloy              |
| `npm run alloy:logs`   | Переглядати службові логи Alloy     |
| `make stop`            | Зупинити web, API та Docker-сервіси |

## Змінні середовища

Кореневий [`.env.example`](./.env.example) містить повний локальний приклад. Окремі приклади для застосунків розташовані в `apps/api/.env.example` та `apps/web/.env.example`.

Не додавайте справжні секрети до репозиторію. Локальні `.env`-файли ігноруються Git.
