#!/bin/bash
echo "🚀 Starting app..."
echo "📋 Environment variables check:"
echo "BOT_TOKEN: ${BOT_TOKEN:0:10}... (длина: ${#BOT_TOKEN})"
echo "SUPER_ADMIN_ID: $SUPER_ADMIN_ID"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:20}... (длина: ${#DATABASE_URL})"
echo ""

# Проверка что переменные не пустые
if [ -z "$BOT_TOKEN" ]; then
    echo "⚠️ BOT_TOKEN пустой!"
else
    echo "✅ BOT_TOKEN присутствует"
fi

if [ -z "$SUPER_ADMIN_ID" ]; then
    echo "⚠️ SUPER_ADMIN_ID пустой!"
else
    echo "✅ SUPER_ADMIN_ID присутствует"
fi

echo ""
echo "🔧 Starting Node.js app..."
exec node dist/bot.js