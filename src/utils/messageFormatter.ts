export class MessageFormatter {
  static formatCheckResult(result: any, type: string): string {
    let message = '';
    
    switch (type) {
      case 'safecheck':
        const statusIcon = result.is_safe ? '✅' : '⚠️';
        const riskLevel = result.risk_score < 30 ? 'Низкий' : 
                         result.risk_score < 60 ? 'Средний' : 'Высокий';
        
        message = `
${statusIcon} *Результат SafeCheck*

📍 Адрес: \`${result.address}\`
🛡️ Статус: ${result.is_safe ? 'Безопасный' : 'Подозрительный'}
📊 Оценка риска: ${result.risk_score}/100 (${riskLevel})
🕒 Проверено: ${new Date(result.last_checked).toLocaleString('ru-RU')}
📡 Источник: ${result.source}
        `;

        if (result.risk_factors.length > 0) {
          message += `\n⚠️ *Факторы риска:*\n`;
          result.risk_factors.forEach((factor: string) => {
            message += `• ${factor}\n`;
          });
        }
        break;

      case 'tron':
        const balanceInTrx = (result.balance / 1000000).toFixed(6);
        const riskIcon = result.risk_assessment?.level === 'LOW' ? '🟢' :
                        result.risk_assessment?.level === 'MEDIUM' ? '🟡' :
                        result.risk_assessment?.level === 'HIGH' ? '🟠' : '🔴';

        message = `
📊 *Анализ Tron адреса*

📍 Адрес: \`${result.address}\`
💰 Баланс TRX: ${balanceInTrx} TRX
📅 Создан: ${new Date(result.created_time).toLocaleDateString('ru-RU')}
📈 Транзакций: ${result.transactions_count}
        `;

        if (result.last_operation_time) {
          message += `🕒 Последняя активность: ${new Date(result.last_operation_time).toLocaleDateString('ru-RU')}\n`;
        }

        if (result.trc20_balances?.length > 0) {
          message += `\n💎 *TRC20 токены:*\n`;
          result.trc20_balances.slice(0, 5).forEach((token: any) => {
            const balance = (parseFloat(token.balance) / Math.pow(10, token.decimals)).toFixed(2);
            message += `• ${token.token_symbol}: ${balance}\n`;
          });
          if (result.trc20_balances.length > 5) {
            message += `• ...и еще ${result.trc20_balances.length - 5} токенов\n`;
          }
        }

        if (result.risk_assessment) {
          message += `\n${riskIcon} *Оценка рисков:*\n`;
          message += `📊 Уровень: ${result.risk_assessment.level}\n`;
          message += `🎯 Оценка: ${result.risk_assessment.score}/100\n`;
        }
        break;

      case 'rapira':
        const threatIcon = result.is_malicious ? '🚨' : '✅';
        const threatLevel = result.threat_level < 30 ? 'Низкий' :
                           result.threat_level < 60 ? 'Средний' : 'Высокий';

        message = `
${threatIcon} *Rapira проверка*

🎯 Цель: \`${result.target}\`
📋 Тип: ${result.type === 'domain' ? 'Домен' : 'Адрес'}
🛡️ Статус: ${result.is_malicious ? 'ВРЕДОНОСНЫЙ' : 'Безопасный'}
⚡ Уровень угрозы: ${result.threat_level}/100 (${threatLevel})
📝 Описание: ${result.description}
        `;

        if (result.categories?.length > 0) {
          message += `\n🏷️ *Категории:*\n`;
          result.categories.forEach((category: string) => {
            message += `• ${category}\n`;
          });
        }
        break;
    }

    return message;
  }

  static formatUserInfo(user: any, role: any, stats: any): string {
    return `
👤 *Информация о пользователе*

🆔 ID: \`${user.id}\`
👤 Имя: ${user.first_name || 'Не указано'}
📱 Username: ${user.username ? '@' + user.username : 'Не указано'}
🏷️ Роль: ${role?.name || 'Не назначена'}
📅 Регистрация: ${new Date(user.registered_at).toLocaleDateString('ru-RU')}
🕒 Последняя активность: ${new Date(user.last_activity).toLocaleDateString('ru-RU')}

📊 *Статистика:*
📈 Всего запросов: ${stats.total}
✅ Успешных: ${stats.completed}
❌ Ошибок: ${stats.failed}

🔐 *Разрешения:*
${role?.permissions.map((p: any) => `• ${p.name}`).join('\n') || 'Нет разрешений'}
    `;
  }

  static formatSystemStats(data: any): string {
    return `
📊 *Статистика системы*

👥 *Пользователи:*
• Всего: ${data.totalUsers}
• Активных сегодня: ${data.activeToday}
• Активных за неделю: ${data.activeWeek}

📈 *Запросы:*
• Всего: ${data.totalRequests}
• За сегодня: ${data.requestsToday}
• За неделю: ${data.requestsWeek}
• Успешных: ${data.successfulRequests}
• Ошибок: ${data.failedRequests}

💾 *Кеши:*
• SafeCheck: ${data.cacheStats.safecheck} записей
• Tron: ${data.cacheStats.tron} записей
• Rapira: ${data.cacheStats.rapira} записей

🕒 Обновлено: ${new Date().toLocaleString('ru-RU')}
    `;
  }

  static truncateMessage(message: string, maxLength: number = 4000): string {
    if (message.length <= maxLength) {
      return message;
    }
    
    return message.substring(0, maxLength - 50) + '\n\n... (сообщение обрезано)';
  }

  static formatError(error: any): string {
    return `❌ *Ошибка:* ${error.message || 'Неизвестная ошибка'}`;
  }

  static formatProgress(current: number, total: number, action: string): string {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    return `
⏳ *${action}*

📊 Прогресс: ${current}/${total} (${percentage}%)
${progressBar}
    `;
  }
}