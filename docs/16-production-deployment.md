# Production-деплой у Docker Compose

## Склад стека

`compose.production.yml` запускає:

- PostgreSQL 17 із persistent volume;
- одноразові SQL-міграції перед запуском API;
- API з ECR на порту `3001`;
- web із ECR на порту `3000`;
- Grafana Alloy, який читає API-лог і надсилає його до Loki.

Alloy підключається до зовнішньої Docker-мережі `observability_observability`, у якій має бути доступний контейнер `observability-loki`.

## Конфігурація

На сервері створіть `.env.production` за прикладом `.env.production.example`. Файл має бути доступний лише власнику:

```bash
chmod 600 .env.production
```

`POSTGRES_PASSWORD` має складатися з URL-safe символів, оскільки він входить до `DATABASE_URL`. Для production API потрібні HTTPS-origin, secure cookie та ім'я cookie `__Host-mt_session`.

Якщо тимчасове середовище доступне лише через HTTP, задайте `API_NODE_ENV=staging`, `AUTH_COOKIE_SECURE=false`, `AUTH_COOKIE_NAME=mt_session` і точний HTTP origin web-застосунку. Не використовуйте цей режим після налаштування домену та TLS.

## Запуск

Спочатку авторизуйте Docker у ECR, потім виконайте:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d
```

Міграції запускаються окремим сервісом `migrate`. API стартує лише після успішних міграцій, web — після успішного healthcheck API, а Alloy — після healthcheck API.

## CI/CD через GitHub Actions

Workflow `.github/workflows/deploy.yml` запускається після push у `main` або вручну через `workflow_dispatch`:

1. перевіряє lint, типи й тести;
2. паралельно збирає `api` і `web` для `linux/amd64`;
3. завантажує образи в ECR із незмінним тегом повного Git commit SHA;
4. через SSH оновлює checkout на EC2 та запускає `scripts/deploy-ec2.sh`;
5. запускає міграції, оновлює контейнери й перевіряє health endpoints.

> **Тимчасово:** production-деплой `web` вимкнено в `scripts/deploy-ec2.sh`. Web-образ збирається та завантажується в ECR, але web-контейнер і `WEB_IMAGE_TAG` на EC2 не оновлюються.

Одночасно може виконуватися лише один production-деплой. Якщо запуск або healthcheck неуспішний, deploy-скрипт намагається повернути попередні образи. Міграції БД мають бути backward-compatible, оскільки автоматичний rollback SQL-схеми не виконується.

### GitHub Environment і variables

Створіть GitHub Environment `production`. За потреби додайте required reviewers. У Repository settings → Secrets and variables → Actions → Variables задайте:

| Variable | Приклад | Призначення |
| --- | --- | --- |
| `AWS_REGION` | `eu-central-1` | регіон ECR та EC2 |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/money-tracker-github-actions` | роль, яку GitHub отримує через OIDC |
| `EC2_HOST` | `ec2-1-2-3-4.eu-central-1.compute.amazonaws.com` | public DNS або IP EC2 |
| `EC2_SSH_PORT` | `22` | SSH-порт; необов'язково, типово `22` |
| `EC2_PROJECT_DIR` | `/home/ec2-user/money-tracker` | абсолютний шлях до git checkout на EC2 |
| `EC2_DEPLOY_USER` | `ec2-user` | SSH-користувач із доступом до git repository та Docker; необов'язково, типово `ec2-user` |

У GitHub Environment `production` додайте secrets:

| Secret | Значення |
| --- | --- |
| `EC2_SSH_PRIVATE_KEY` | окремий приватний SSH-ключ для CI/CD у PEM/OpenSSH форматі |
| `EC2_KNOWN_HOSTS` | перевірений рядок host key для EC2 з `known_hosts` |

AWS access keys і production `.env` у GitHub не потрібні. Не використовуйте особистий SSH-ключ: створіть окрему пару для CI/CD, а public key додайте в `/home/ec2-user/.ssh/authorized_keys`.

### OIDC role для GitHub Actions

Додайте в IAM OIDC provider `https://token.actions.githubusercontent.com` з audience `sts.amazonaws.com`. Trust policy ролі обмежте цим repository та Environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:environment:production"
      }
    }
  }]
}
```

Мінімальна permissions policy для workflow (замініть account і region):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": [
        "arn:aws:ecr:eu-central-1:123456789012:repository/money-tracker/api",
        "arn:aws:ecr:eu-central-1:123456789012:repository/money-tracker/web"
      ]
    }
  ]
}
```

### Підготовка EC2

- EC2 instance profile має містити read-only доступ до двох ECR repositories (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability`). SSM-права не потрібні.
- Встановіть AWS CLI v2, Docker із Compose plugin, Git і `curl`.
- Додайте `EC2_DEPLOY_USER` до групи `docker` та налаштуйте для нього read-only доступ до GitHub repository.
- Клонуйте repository у `EC2_PROJECT_DIR`, створіть там `.env.production` із правами `600` і переконайтеся, що зовнішня мережа `observability_observability` існує.
- ECR repositories мають називатися `money-tracker/api` та `money-tracker/web`.
- Security Group має дозволяти вхід на `EC2_SSH_PORT` від GitHub Actions runner. GitHub-hosted runners не мають сталої IP-адреси; для вузького allowlist використовуйте self-hosted runner або GitHub runner зі static IP.

Перед збереженням `EC2_KNOWN_HOSTS` звірте fingerprint host key з `/etc/ssh/ssh_host_ed25519_key.pub` на EC2. Перший деплой можна запустити в GitHub у Actions → CI/CD → Run workflow; SSH-вивід буде доступний у job `Deploy to EC2`.

## Перевірка

```bash
docker compose --env-file .env.production -f compose.production.yml ps
curl --fail http://127.0.0.1:3001/api/v1/health
curl --fail http://127.0.0.1:3000/
```

Службовий HTTP endpoint Alloy доступний лише локально на сервері через `127.0.0.1:12346`.
