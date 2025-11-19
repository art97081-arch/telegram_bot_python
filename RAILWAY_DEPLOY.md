# Развертывание Telegram Bot на Railway

## Предварительная подготовка

### 1. Создание проекта на Railway
1. Зайти на [railway.app](https://railway.app)
2. Создать новый проект
3. Подключить GitHub репозиторий

### 2. Настройка базы данных PostgreSQL
1. В проекте Railway добавить сервис PostgreSQL
2. Railway автоматически создаст переменную `DATABASE_URL`

### 3. Настройка переменных окружения

Скопировать переменные из `.env.example` в настройки Railway:

```bash
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# Admin Settings  
SUPER_ADMIN_ID=your_telegram_user_id

# API Keys
SAFECHECKAI_API_KEY=your_safecheckai_api_key
RAPIRA_API_TOKEN=your_rapira_api_token

# Database - автоматически создается Railway
DATABASE_URL=postgresql://username:password@host:port/database

# Server (опционально)
PORT=3000
```

## Развертывание

### Автоматическое развертывание
Railway автоматически развернет бот при пуше в main ветку благодаря `railway.json`.

### Ручное развертывание
```bash
# Установить Railway CLI
npm install -g @railway/cli

# Войти в аккаунт
railway login

# Связать с проектом
railway link

# Развернуть
railway up
```

## Проверка работы

1. **Healthcheck**: `https://your-app.railway.app/health`
2. **Logs**: В панели Railway или через CLI `railway logs`
3. **Database**: Таблицы создаются автоматически при первом запуске

## Структура проекта

```
src/
├── bot.ts                 # Главный файл бота с HTTP сервером
├── services/
│   ├── databaseService.ts # PostgreSQL интеграция
│   ├── notificationService.ts # Умные уведомления
│   └── ...
├── commands/             # Команды бота
├── middleware/           # Middleware для авторизации
└── types/               # TypeScript типы
```

## Особенности Railway

- **Автоматическая база данных**: PostgreSQL настраивается автоматически
- **Healthcheck**: Встроенная проверка на `/health`
- **Graceful shutdown**: Корректная остановка сервиса
- **Автодеплой**: Развертывание при каждом пуше в main

## Мониторинг

- **Логи**: Railway автоматически собирает логи
- **Метрики**: Доступны в панели Railway  
- **Алерты**: Настраиваются в настройках проекта

## Troubleshooting

### База данных не подключается
- Проверить `DATABASE_URL` в переменных окружения
- Убедиться, что PostgreSQL сервис запущен

### Бот не отвечает
- Проверить `BOT_TOKEN` 
- Проверить логи на наличие ошибок
- Убедиться, что healthcheck возвращает 200

### Таблицы не создаются
- Проверить права доступа к базе данных
- Посмотреть логи создания таблиц при запуске