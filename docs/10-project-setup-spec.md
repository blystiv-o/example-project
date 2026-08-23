# Специфікація сетапу проєкту
> Петпроєкт Money Tracker. Мета цього документа - зафіксувати простий стартовий скелет monorepo без бізнес-логіки.

## Ціль

Створити TypeScript monorepo з фронтендом на React/Next.js, бекендом на NestJS і спільним пакетом для типів та DTO. Після сетапу проєкт має запускатися локально, проходити базові перевірки й давати зрозумілу структуру для наступних задач.

## Стек

- Monorepo: npm workspaces + Turborepo.
- Frontend: Next.js, React, MUI, Material Design 3 з `docs/visual-design`.
- Backend: NestJS REST API.
- Shared: TypeScript + Zod для спільних схем і типів.
- DB: Postgres у Docker Compose.
- Tests: Vitest для shared/frontend; для NestJS можна залишити Jest, якщо його дає scaffold.

## Структура

```text
money-tracker/
  apps/
    web/      # Next.js UI
    api/      # NestJS API
  packages/
    shared/   # DTO, Zod-схеми, enum-и, constants
  docs/
    adr/
    visual-design/
  docker-compose.yml
  package.json
  turbo.json
  tsconfig.base.json
  eslint.config.js
  prettier.config.js
  README.md
```

## Рішення

- Root `package.json` приватний і містить workspaces `apps/*`, `packages/*`.
- Пакети називаються `@money-tracker/web`, `@money-tracker/api`, `@money-tracker/shared`.
- Імпорти між пакетами тільки через workspace scope, наприклад `@money-tracker/shared`.
- Усередині пакета використовується alias `@/` на `src`.
- Один `tsconfig.base.json` у корені, strict TypeScript для всіх пакетів.
- Один ESLint flat config і один Prettier config у корені.
- `packages/shared` є джерелом істини для DTO: Zod-схема -> `z.infer` type.
- `apps/api` має `/api/v1/health` і placeholder-модулі `auth`, `users`, `categories`, `expenses`.
- `apps/web` має placeholder-маршрути `/login`, `/dashboard`, `/expenses`, `/categories`, `/profile`.
- Swagger/OpenAPI можна підключити для dev-режиму, але DTO не дублюються вручну.
- Docker Compose підіймає Postgres; `.env.example` документує потрібні змінні.

## Скрипти

- `npm run dev` - запустити web і api.
- `npm run dev:web` / `npm run dev:api` - запустити один застосунок.
- `npm run db:up` / `npm run db:down` - керувати Postgres.
- `npm run build` - зібрати всі пакети.
- `npm run lint` - перевірити lint.
- `npm run typecheck` - перевірити типи.
- `npm run test` - запустити тести.

## Не робимо в цій фазі

- Не реалізуємо авторизацію.
- Не реалізуємо CRUD витрат і категорій.
- Не створюємо повну модель БД і міграції.
- Не робимо pixel-perfect перенос дизайну.
- Не додаємо CI/CD або production deploy.

## Acceptance Criteria

- [ ] `npm install` працює з кореня й бачить усі workspaces.
- [ ] `npm run dev` запускає frontend і backend.
- [ ] `npm run build`, `lint`, `typecheck`, `test` проходять з кореня.
- [ ] `apps/web` створений на Next.js і має базові маршрути з вимог.
- [ ] `apps/api` створений на NestJS і має робочий `GET /api/v1/health`.
- [ ] `packages/shared` експортує приклад Zod-схеми, derived type, enum і constant.
- [ ] Web і API імпортують приклад з `@money-tracker/shared`.
- [ ] Docker Compose запускає Postgres, env-приклади додані.
- [ ] README пояснює запуск, структуру й основні команди.
