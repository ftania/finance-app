# Запуск через Docker

Цей проєкт можна запустити через Docker Compose. Compose піднімає три сервіси:

- `postgres` - локальна PostgreSQL база даних;
- `server` - Node.js + Express backend;
- `client` - React + Vite frontend.

## Передумови

Потрібно встановити Docker або Docker Desktop.

## Env-змінні

Секрети не записуються в `Dockerfile` і не мають потрапляти в репозиторій.

Перед запуском переконайтесь, що існує файл:

```bash
server/.env
```

Його можна створити на основі:

```bash
server/.env.example
```

У `server/.env` все одно мають бути налаштовані секрети застосунку, наприклад:

```env
JWT_SECRET=replace_with_a_long_random_secret
MONOBANK_TOKEN_SECRET=replace_with_a_long_random_secret_for_bank_tokens
CLIENT_URL=http://localhost:5173
```

SMTP-змінні потрібні тільки для реальної відправки листів відновлення пароля.

## Запуск

У корені проєкту виконайте:

```bash
docker compose up --build
```

Після запуску:

- клієнтська частина: `http://localhost:5173`
- серверний API: `http://localhost:5001/api`
- PostgreSQL: `localhost:5433`

## Зупинка

Зупинити контейнери:

```bash
docker compose down
```

Зупинити контейнери й видалити дані бази:

```bash
docker compose down -v
```

## Корисні команди

Переглянути логи:

```bash
docker compose logs -f
```

Переглянути логи тільки backend:

```bash
docker compose logs -f server
```

Перезібрати тільки backend:

```bash
docker compose build server
```

Перезібрати тільки frontend:

```bash
docker compose build client
```

## Примітки

- PostgreSQL дані зберігаються у Docker volume `postgres_data`.
- Якщо змінити `server/.env`, перезапустіть backend контейнер.
- Якщо порт `5433`, `5001` або `5173` вже зайнятий, змініть відповідний port mapping у `docker-compose.yml`.
