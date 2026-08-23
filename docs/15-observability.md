# Доставка API-логів до Loki

## Призначення

Grafana Alloy читає NDJSON-логи API з `logs/api.log` і надсилає їх до Loki через HTTP push API. Alloy працює в Docker Compose як сервіс `alloy`.

## Запуск

Loki має бути доступним із Docker-контейнера. Для Loki, запущеного на хості на порту `3101`, достатньо дефолтної конфігурації:

```bash
npm run alloy:up
```

Стан контейнера та службові логи:

```bash
docker compose ps alloy
npm run alloy:logs
```

Діагностичний UI Alloy доступний на [http://localhost:12346](http://localhost:12346).

## Змінні середовища

| Змінна           | Значення за замовчуванням                           | Призначення                        |
| ---------------- | --------------------------------------------------- | ---------------------------------- |
| `LOKI_URL`       | `http://host.docker.internal:3101/loki/api/v1/push` | Повний URL Loki HTTP push endpoint |
| `LOKI_TENANT_ID` | `tenant1`                                           | Ідентифікатор tenant у Loki        |
| `ALLOY_VERSION`  | `v1.18.0`                                           | Версія Docker image Grafana Alloy  |
| `ALLOY_PORT`     | `12346`                                             | Локальний порт діагностичного UI   |

Приклад `.env` для Loki в іншій мережі:

```dotenv
LOKI_URL=http://loki:3100/loki/api/v1/push
LOKI_TENANT_ID=tenant1
```

Після зміни env перезапустіть контейнер:

```bash
docker compose up -d --force-recreate alloy
```

`localhost` усередині контейнера вказує на сам контейнер. Тому для Loki на локальній машині використовується `host.docker.internal`. Compose також додає `host-gateway`, щоб ця адреса працювала на Linux Docker Engine. Поточний локальний Loki працює в multi-tenant режимі, тому Alloy передає `LOKI_TENANT_ID` як заголовок `X-Scope-OrgID`.

## Обробка логів

Каталог `logs/` монтується в контейнер у read-only режимі. Конфіг `observability/alloy/config.alloy`:

1. читає лише `/var/log/money-tracker/api.log`;
2. розбирає кожен рядок як JSON;
3. додає `job`, `service`, `environment` і `level` як Loki labels;
4. надсилає оригінальний JSON-рядок до `LOKI_URL`.

`trace_id` не перетворюється на label, щоб уникнути високої кардинальності. Позиція читання зберігається у Docker volume `money-tracker-alloy`, тому після перезапуску Alloy продовжує читання з останнього обробленого рядка.

## Перевірка в Loki

Після появи нового error-логу виконайте запит у Grafana Explore або через Loki API:

```logql
{job="money-tracker-api"} | json
```

Приклад фільтрації за рівнем і середовищем:

```logql
{job="money-tracker-api", level="error", environment="development"} | json
```
