#!/bin/bash
echo "🚀 Starting app..."
echo "📋 Environment variables check:"
echo "BOT_TOKEN: ${BOT_TOKEN:0:10}..."
echo "SUPER_ADMIN_ID: $SUPER_ADMIN_ID"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo ""
echo "🔧 Starting Node.js app..."
exec node dist/bot.js