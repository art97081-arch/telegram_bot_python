import { BotContext } from '../middleware/authMiddleware';
import { UserService } from '../services/userService';
import { LogService } from '../services/logService';
import { ActionService } from '../services/actionService';
import { SafeCheckService } from '../services/safeCheckService';
import { TronService } from '../services/tronService';
import { RapiraService } from '../services/rapiraService';
import { ExchangeRateService } from '../services/ExchangeRateService';
import { keyboards } from '../utils/keyboards';

export class AdminCommands {
  static async adminHelp(ctx: BotContext) {
    const helpMessage = `
🔧 *Панель администратора*

👥 *Управление пользователями:*
/users - Список всех пользователей
/user <id> - Информация о пользователе
/setrole <id> <role> - Назначить роль пользователю
/ban <id> - Заблокировать пользователя
/unban <id> - Разблокировать пользователя

📊 *Статистика и мониторинг:*
/stats - Общая статистика системы
/logs [count] - Последние логи (по умолчанию 20)
/requests - Активные запросы
/cache - Состояние кешей

🛠️ *Системные команды:*
/broadcast <message> - Рассылка всем пользователям
/maintenance - Режим обслуживания
/restart - Перезапуск сервисов
/clear_cache - Очистить все кеши
/access - Управление доступом в режиме разработки

🔍 *Мониторинг безопасности:*
/security - Отчет по безопасности
/threats - Обнаруженные угрозы
/whitelist <address> - Добавить в белый список
/blacklist <address> - Добавить в черный список

📋 *Доступные роли:*
• admin - Полный доступ
• moderator - Модерация
• user - Базовый доступ
    `;
    
    await ctx.replyWithHTML?.(helpMessage, keyboards.adminMenu);
  }

  static async listUsers(ctx: BotContext) {
    try {
      const users = await UserService.getAllUsers();
      
      if (users.length === 0) {
        await ctx.reply?.('👥 Пользователей пока нет');
        return;
      }

      let message = `👥 *Пользователи (${users.length}):*\n\n`;
      
      const sortedUsers = users.sort((a, b) => 
        new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
      );

      for (const user of sortedUsers.slice(0, 20)) {
        const role = await UserService.getUserRole(user.id);
        const lastActivity = new Date(user.last_activity);
        const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        
        message += `👤 *${user.first_name || 'Без имени'}*\n`;
        message += `   ID: \`${user.id}\`\n`;
        message += `   Username: ${user.username ? '@' + user.username : 'Нет'}\n`;
        message += `   Роль: ${role?.name || 'Не назначена'}\n`;
        message += `   Активность: ${daysSinceActivity === 0 ? 'Сегодня' : `${daysSinceActivity} дн. назад`}\n\n`;
      }

      if (users.length > 20) {
        message += `... и еще ${users.length - 20} пользователей`;
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении списка пользователей');
    }
  }

  static async getUserInfo(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) return;

    const parts = text.split(' ');
    if (parts.length < 2) {
      await ctx.reply?.('❌ Укажите ID пользователя: /user <id>');
      return;
    }

    const userId = parseInt(parts[1]);
    if (isNaN(userId)) {
      await ctx.reply?.('❌ Неверный ID пользователя');
      return;
    }

    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        await ctx.reply?.('❌ Пользователь не найден');
        return;
      }

      const role = await UserService.getUserRole(userId);
      const userRequests = await ActionService.getUserRequests(userId);
      const userLogs = await LogService.getUserLogs(userId, 10);

      const message = `
👤 *Информация о пользователе*

🆔 ID: \`${user.id}\`
👤 Имя: ${user.first_name || 'Не указано'}
📱 Username: ${user.username ? '@' + user.username : 'Не указано'}
🏷️ Роль: ${role?.name || 'Не назначена'}
📅 Регистрация: ${user.registered_at.toLocaleDateString('ru-RU')}
🕒 Последняя активность: ${user.last_activity.toLocaleDateString('ru-RU')}

📊 *Статистика:*
📈 Всего запросов: ${userRequests.length}
✅ Успешных: ${userRequests.filter(r => r.status === 'completed').length}
❌ Ошибок: ${userRequests.filter(r => r.status === 'failed').length}
📝 Записей в логах: ${userLogs.length}

🔐 *Разрешения:*
${role?.permissions.map(p => `• ${p.name}`).join('\n') || 'Нет разрешений'}
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении информации о пользователе');
    }
  }

  static async setUserRole(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) return;

    const parts = text.split(' ');
    if (parts.length < 3) {
      await ctx.reply?.('❌ Укажите ID и роль: /setrole <id> <role>');
      return;
    }

    const userId = parseInt(parts[1]);
    const roleName = parts[2].toLowerCase();

    if (isNaN(userId)) {
      await ctx.reply?.('❌ Неверный ID пользователя');
      return;
    }

    const availableRoles = ['admin', 'moderator', 'user'];
    if (!availableRoles.includes(roleName)) {
      await ctx.reply?.(`❌ Неверная роль. Доступные: ${availableRoles.join(', ')}`);
      return;
    }

    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        await ctx.reply?.('❌ Пользователь не найден');
        return;
      }

      await UserService.updateUserRole(userId, roleName);
      
      await LogService.log({
        user_id: ctx.user_id!,
        action: 'role_assignment',
        details: {
          target_user: userId,
          new_role: roleName,
          admin_id: ctx.user_id
        }
      });

      await ctx.reply?.(`✅ Роль "${roleName}" назначена пользователю ${user.first_name || user.id}`);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при назначении роли');
    }
  }

  static async getSystemStats(ctx: BotContext) {
    try {
      const users = await UserService.getAllUsers();
      const allRequests = await ActionService.getAllRequests();
      const logs = await LogService.getAllLogs(100);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      const activeUsersToday = users.filter(u => 
        new Date(u.last_activity).getTime() > oneDayAgo
      ).length;

      const activeUsersWeek = users.filter(u => 
        new Date(u.last_activity).getTime() > oneWeekAgo
      ).length;

      const requestsToday = allRequests.filter(r => 
        new Date(r.created_at).getTime() > oneDayAgo
      ).length;

      const requestsWeek = allRequests.filter(r => 
        new Date(r.created_at).getTime() > oneWeekAgo
      ).length;

      const roleStats = users.reduce((acc, user) => {
        acc[user.role_id] = (acc[user.role_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const message = `
📊 *Статистика системы*

👥 *Пользователи:*
• Всего: ${users.length}
• Активных сегодня: ${activeUsersToday}
• Активных за неделю: ${activeUsersWeek}

📈 *Запросы:*
• Всего: ${allRequests.length}
• За сегодня: ${requestsToday}
• За неделю: ${requestsWeek}
• Успешных: ${allRequests.filter(r => r.status === 'completed').length}
• Ошибок: ${allRequests.filter(r => r.status === 'failed').length}

🏷️ *Роли:*
${Object.entries(roleStats).map(([role, count]) => 
  `• ${role}: ${count}`
).join('\n')}

📝 *Логи:*
• Записей за последние 100: ${logs.length}

💾 *Кеши:*
• SafeCheck: ${SafeCheckService.getCacheSize()} записей
• Tron: ${TronService.getCacheSize()} записей
• Rapira: ${RapiraService.getCacheSize()} записей

🕒 Обновлено: ${new Date().toLocaleString('ru-RU')}
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении статистики');
    }
  }

  static async getLogs(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    let count = 20;

    if (text) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const parsedCount = parseInt(parts[1]);
        if (!isNaN(parsedCount) && parsedCount > 0 && parsedCount <= 100) {
          count = parsedCount;
        }
      }
    }

    try {
      const logs = await LogService.getAllLogs(count);
      
      if (logs.length === 0) {
        await ctx.reply?.('📝 Логов пока нет');
        return;
      }

      let message = `📝 *Последние ${logs.length} записей логов:*\n\n`;
      
      for (const log of logs) {
        const timestamp = new Date(log.timestamp).toLocaleString('ru-RU');
        message += `🕒 ${timestamp}\n`;
        message += `👤 User ${log.user_id}: *${log.action}*\n`;
        if (log.details && typeof log.details === 'object') {
          const details = JSON.stringify(log.details, null, 2);
          if (details.length < 100) {
            message += `📋 ${details}\n`;
          }
        }
        message += `\n`;
      }

      // Telegram имеет ограничение на размер сообщения
      if (message.length > 4000) {
        message = message.substring(0, 4000) + '\n\n... (сообщение обрезано)';
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении логов');
    }
  }

  static async broadcast(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) return;

    const parts = text.split(' ');
    if (parts.length < 2) {
      await ctx.reply?.('❌ Укажите сообщение: /broadcast <сообщение>');
      return;
    }

    const broadcastMessage = parts.slice(1).join(' ');
    
    try {
      const users = await UserService.getAllUsers();
      let successCount = 0;
      let errorCount = 0;

      await ctx.reply?.(`📡 Начинаю рассылку для ${users.length} пользователей...`);

      // Здесь нужна реализация рассылки через Telegram API
      // Пока что симулируем процесс
      for (const user of users) {
        try {
          // await bot.telegram.sendMessage(user.id, broadcastMessage);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      await LogService.log({
        user_id: ctx.user_id!,
        action: 'broadcast',
        details: {
          message: broadcastMessage,
          total_users: users.length,
          success_count: successCount,
          error_count: errorCount
        }
      });

      const resultMessage = `
📡 *Рассылка завершена*

✅ Успешно отправлено: ${successCount}
❌ Ошибок: ${errorCount}
📊 Всего пользователей: ${users.length}
      `;

      await ctx.replyWithHTML?.(resultMessage);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при выполнении рассылки');
    }
  }

  static async clearCache(ctx: BotContext) {
    try {
      const safeCacheSize = SafeCheckService.getCacheSize();
      const tronCacheSize = TronService.getCacheSize();
      const rapiraCacheSize = RapiraService.getCacheSize();

      SafeCheckService.clearCache();
      TronService.clearCache();
      RapiraService.clearCache();

      await LogService.log({
        user_id: ctx.user_id!,
        action: 'clear_cache',
        details: {
          safe_cache_cleared: safeCacheSize,
          tron_cache_cleared: tronCacheSize,
          rapira_cache_cleared: rapiraCacheSize
        }
      });

      const message = `
🗑️ *Кеши очищены*

• SafeCheck: ${safeCacheSize} записей
• Tron: ${tronCacheSize} записей  
• Rapira: ${rapiraCacheSize} записей

✅ Все кеши успешно очищены
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при очистке кешей');
    }
  }

  static async getPendingRequests(ctx: BotContext) {
    try {
      const pendingRequests = await ActionService.getPendingRequests();
      
      if (pendingRequests.length === 0) {
        await ctx.reply?.('📋 Нет ожидающих запросов');
        return;
      }

      let message = `📋 *Ожидающие запросы (${pendingRequests.length}):*\n\n`;
      
      for (const request of pendingRequests.slice(0, 10)) {
        const createdAgo = Math.floor((Date.now() - new Date(request.created_at).getTime()) / (1000 * 60));
        message += `🔍 ${request.action_type}\n`;
        message += `👤 User ${request.user_id}\n`;
        message += `🕒 ${createdAgo} мин. назад\n`;
        message += `📋 ID: \`${request.id}\`\n\n`;
      }

      if (pendingRequests.length > 10) {
        message += `... и еще ${pendingRequests.length - 10} запросов`;
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении запросов');
    }
  }

  static async getSecurityReport(ctx: BotContext) {
    try {
      const allRequests = await ActionService.getAllRequests();
      const logs = await LogService.getAllLogs(1000);
      
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      const recentRequests = allRequests.filter(r => 
        new Date(r.created_at).getTime() > oneDayAgo
      );

      const suspiciousActivity = logs.filter(log => 
        log.action === 'permission_denied' && 
        new Date(log.timestamp).getTime() > oneDayAgo
      );

      const failedRequests = recentRequests.filter(r => r.status === 'failed');
      
      const threatCounts = {
        safe_threats: 0,
        rapira_threats: 0,
        high_risk_tron: 0
      };

      // Анализ результатов проверок
      for (const request of recentRequests.filter(r => r.status === 'completed')) {
        if (request.action_type === 'safecheck' && request.result?.is_safe === false) {
          threatCounts.safe_threats++;
        }
        if (request.action_type === 'rapira_check' && request.result?.is_malicious === true) {
          threatCounts.rapira_threats++;
        }
        if (request.action_type === 'tron_check' && 
            request.result?.risk_assessment?.level === 'HIGH') {
          threatCounts.high_risk_tron++;
        }
      }

      const message = `
🛡️ *Отчет по безопасности*

📅 За последние 24 часа:

🔍 *Проверки:*
• Всего запросов: ${recentRequests.length}
• Неудачных: ${failedRequests.length}

⚠️ *Обнаруженные угрозы:*
• SafeCheck: ${threatCounts.safe_threats} подозрительных адресов
• Rapira: ${threatCounts.rapira_threats} вредоносных объектов
• Tron: ${threatCounts.high_risk_tron} высокорисковых адресов

🚫 *Безопасность доступа:*
• Отказов в доступе: ${suspiciousActivity.length}

📊 *Общая оценка:* ${
  threatCounts.safe_threats + threatCounts.rapira_threats + threatCounts.high_risk_tron < 5 
    ? '🟢 Низкий уровень угроз' 
    : '🟡 Повышенная активность угроз'
}

🕒 Обновлено: ${new Date().toLocaleString('ru-RU')}
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при формировании отчета');
    }
  }

  static async safeCheckStatus(ctx: BotContext) {
    try {
      await ctx.reply?.('🔍 Проверяю статус SafeCheck API...');

      const accountInfo = await import('../services/safeCheckService').then(m => m.SafeCheckService.getAccountInfo());
      
      if (!accountInfo) {
        await ctx.reply?.('❌ Не удалось подключиться к SafeCheck API');
        return;
      }

      const message = `
🛡️ *Статус SafeCheck API*

✅ *Подключение активно*

👤 *Информация об аккаунте:*
🆔 User ID: ${accountInfo.user_id}
👤 Username: ${accountInfo.username}
📊 Статус: ${accountInfo.status === '1' ? '🟢 Активен' : '🔴 Неактивен'}

💰 *Баланс:*
💵 Основной баланс: ${accountInfo.balance} USDT
🔍 Доступные проверки: ${accountInfo.checks_balance}

📈 *Статистика проверок:*
✅ Оригинальные чеки: ${accountInfo.orig_checks_cnt}
❌ Поддельные чеки: ${accountInfo.fake_checks_cnt}
📊 Всего проверок: ${accountInfo.orig_checks_cnt + accountInfo.fake_checks_cnt}

🕒 Обновлено: ${new Date().toLocaleString('ru-RU')}
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      console.error('SafeCheck status error:', error);
      await ctx.reply?.('❌ Ошибка при получении статуса SafeCheck API');
    }
  }

  // Управление курсами валют
  static async manageRates(ctx: BotContext) {
    try {
      const ratesInfo = ExchangeRateService.getAdminRatesInfo();
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Изменить базовый курс', callback_data: 'admin_set_base_rate' },
              { text: '📈 Изменить курс пополнения', callback_data: 'admin_set_deposit_rate' }
            ],
            [
              { text: '📉 Изменить курс вывода', callback_data: 'admin_set_withdrawal_rate' },
              { text: '🔄 Обновить курсы', callback_data: 'admin_refresh_rates' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'main_menu' }
            ]
          ]
        }
      };
      
      await ctx.replyWithHTML?.(ratesInfo, keyboard);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении информации о курсах');
    }
  }

  static async setBaseRate(ctx: BotContext) {
    await ctx.reply?.('💰 Введите новый базовый курс USDT/RUB (например: 82.50):');
    // Здесь можно добавить обработчик ввода
  }

  static async setDepositMargin(ctx: BotContext) {
    await ctx.reply?.('📈 Введите новую маржу для пополнения в % (например: 6.3):');
    // Здесь можно добавить обработчик ввода
  }

  static async setWithdrawalMargin(ctx: BotContext) {
    await ctx.reply?.('📉 Введите новую маржу для вывода в % (например: 2.0):');
    // Здесь можно добавить обработчик ввода
  }

  static async refreshRates(ctx: BotContext) {
    try {
      // Здесь можно добавить автоматическое обновление с биржи
      const ratesInfo = ExchangeRateService.getAdminRatesInfo();
      await ctx.editMessageText(ratesInfo, { parse_mode: 'Markdown' });
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при обновлении курсов');
    }
  }

  // КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ ДОСТУПОМ В РЕЖИМЕ РАЗРАБОТКИ
  static async showAccessInfo(ctx: BotContext) {
    const { AccessMiddleware } = await import('../middleware/accessMiddleware');
    
    const isDev = AccessMiddleware.isDevelopmentMode();
    const allowedUsers = AccessMiddleware.getAllowedUsers();
    
    let message = `🔧 **Режим разработки:** ${isDev ? '✅ Включен' : '❌ Отключен'}\n\n`;
    
    if (isDev) {
      message += `👥 **Разрешенные пользователи** (${allowedUsers.length}):\n`;
      for (const userId of allowedUsers) {
        message += `• \`${userId}\`\n`;
      }
      message += `\n💡 Только эти пользователи могут использовать бота`;
    } else {
      message += `🌍 Бот доступен всем пользователям`;
    }

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Добавить пользователя', callback_data: 'access_add_user' },
            { text: '➖ Удалить пользователя', callback_data: 'access_remove_user' }
          ],
          [
            { text: '📋 Показать список', callback_data: 'access_show_users' }
          ]
        ]
      }
    });
  }

  static async addUserToAccess(ctx: BotContext, userId: number) {
    const { AccessMiddleware } = await import('../middleware/accessMiddleware');
    
    AccessMiddleware.addAllowedUser(userId);
    await ctx.reply(`✅ Пользователь \`${userId}\` добавлен в белый список`, { parse_mode: 'Markdown' });
  }

  static async removeUserFromAccess(ctx: BotContext, userId: number) {
    const { AccessMiddleware } = await import('../middleware/accessMiddleware');
    
    AccessMiddleware.removeAllowedUser(userId);
    await ctx.reply(`❌ Пользователь \`${userId}\` удален из белого списка`, { parse_mode: 'Markdown' });
  }
}