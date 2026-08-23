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
4. через AWS Systems Manager оновлює checkout на EC2 та запускає `scripts/deploy-ec2.sh`;
5. запускає міграції, оновлює контейнери й перевіряє health endpoints.

Одночасно може виконуватися лише один production-деплой. Якщо запуск або healthcheck неуспішний, deploy-скрипт намагається повернути попередні образи. Міграції БД мають бути backward-compatible, оскільки автоматичний rollback SQL-схеми не виконується.

### GitHub Environment і variables

Створіть GitHub Environment `production`. За потреби додайте required reviewers. У Repository settings → Secrets and variables → Actions → Variables задайте:

| Variable | Приклад | Призначення |
| --- | --- | --- |
| `AWS_REGION` | `eu-central-1` | регіон ECR та EC2 |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/money-tracker-github-actions` | роль, яку GitHub отримує через OIDC |
| `EC2_INSTANCE_ID` | `i-0123456789abcdef0` | EC2 instance, зареєстрований у Systems Manager |
| `EC2_PROJECT_DIR` | `/opt/money-tracker` | абсолютний шлях до git checkout на EC2 |
| `EC2_DEPLOY_USER` | `ubuntu` | користувач із доступом до git repository та Docker; необов'язково, типово `ubuntu` |

AWS access keys, SSH-ключ і production `.env` у GitHub не потрібні.

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

Мінімальна permissions policy для workflow (замініть account, region та instance ID):

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
    },
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:eu-central-1::document/AWS-RunShellScript",
        "arn:aws:ec2:eu-central-1:123456789012:instance/i-0123456789abcdef0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    }
  ]
}
```

### Підготовка EC2

- EC2 instance profile має містити `AmazonSSMManagedInstanceCore` і read-only доступ до двох ECR repositories (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability`).
- Встановіть AWS CLI v2, Docker із Compose plugin, Git і `curl`.
- Додайте `EC2_DEPLOY_USER` до групи `docker` та налаштуйте для нього read-only доступ до GitHub repository.
- Клонуйте repository у `EC2_PROJECT_DIR`, створіть там `.env.production` із правами `600` і переконайтеся, що зовнішня мережа `observability_observability` існує.
- ECR repositories мають називатися `money-tracker/api` та `money-tracker/web`.

Перший деплой можна запустити в GitHub у Actions → CI/CD → Run workflow. Його результат і stdout/stderr SSM-команди будуть доступні в job `Deploy to EC2`.

## Перевірка

```bash
docker compose --env-file .env.production -f compose.production.yml ps
curl --fail http://127.0.0.1:3001/api/v1/health
curl --fail http://127.0.0.1:3000/
```

Службовий HTTP endpoint Alloy доступний лише локально на сервері через `127.0.0.1:12346`.
