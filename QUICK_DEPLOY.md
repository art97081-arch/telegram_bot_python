# 🚀 Готово к деплою на Railway!

## Ваш репозиторий: 
https://github.com/art97081-arch/telegram_bot_python.git

## Быстрый старт Railway:

### 1. Создайте проект на Railway
1. Зайдите на https://railway.app
2. Нажмите "New Project"  
3. Выберите "Deploy from GitHub repo"
4. Выберите репозиторий `art97081-arch/telegram_bot_python`

### 2. Добавьте PostgreSQL
1. В проекте нажмите "Add Service"
2. Выберите "PostgreSQL"
3. Railway автоматически создаст `DATABASE_URL`

### 3. Настройте Environment Variables
Скопируйте эти переменные в Railway > Settings > Environment:

```bash
# Telegram Bot (ОБЯЗАТЕЛЬНО!)
BOT_TOKEN=your_telegram_bot_token_from_botfather

# Admin Settings (ОБЯЗАТЕЛЬНО!)
SUPER_ADMIN_ID=your_telegram_user_id

# API Keys (опционально)
SAFECHECKAI_API_KEY=your_safecheckai_api_key
RAPIRA_API_TOKEN=your_rapira_api_token

# Server (опционально, по умолчанию 3000)
PORT=3000
```

### 4. Деплой происходит автоматически!
Railway автоматически:
- ✅ Соберет проект (`npm run build`)
- ✅ Запустит сервер (`npm start`)
- ✅ Создаст таблицы в БД
- ✅ Настроит healthcheck на `/health`

## Проверка работы:

### Healthcheck:
```
https://your-app-name.railway.app/health
```

### Логи:
В панели Railway или через CLI:
```bash
railway logs
```

## Особенности:
- 🔄 **Автодеплой**: каждый push в main автоматически деплоится
- 🗄️ **База данных**: таблицы создаются автоматически при первом запуске
- 🔔 **Smart Notifications**: одно сообщение вместо спама
- ⚡ **Production Ready**: graceful shutdown, error handling

## Troubleshooting:
- Если бот не отвечает → проверьте `BOT_TOKEN`
- Если ошибки БД → проверьте что PostgreSQL добавлен
- Если 500 ошибки → смотрите логи в Railway

**Готово! 🚀**