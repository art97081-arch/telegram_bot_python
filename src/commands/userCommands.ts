import { BotContext } from '../middleware/authMiddleware';
import { SafeCheckService } from '../services/safeCheckService';
import { TronService } from '../services/tronService';
import { RapiraService } from '../services/rapiraService';
import { ActionService } from '../services/actionService';
import { ActionType } from '../types';
import { MessageService } from '../services/MessageService';
import { ExchangeRateService } from '../services/ExchangeRateService';
import { LogService } from '../services/logService';
import { keyboards } from '../utils/keyboards';
import { InputValidator } from '../utils/inputValidator';
import { MessageFormatter } from '../utils/messageFormatter';

export class UserCommands {
  static async start(ctx: BotContext) {
    // Проверяем, является ли пользователь администратором
    const adminId = process.env.ADMIN_ID;
    const isAdmin = adminId && ctx.user_id?.toString() === adminId;

    const welcomeMessage = `
🤖 *Добро пожаловать в Security Bot!*

Я помогу вам проверять безопасность банковских чеков и криптоадресов.

🔐 *Что я умею:*
• Проверка подлинности банковских чеков
• Анализ криптоадресов и кошельков
• Курсы валют и биржевые данные
• Безопасность доменов и URL

Используйте кнопки ниже для навигации:
    `;

    // Отправляем приветствие с соответствующей клавиатурой
    if (isAdmin) {
      await ctx.replyWithHTML?.(welcomeMessage, keyboards.adminMainMenu);
    } else {
      await ctx.replyWithHTML?.(welcomeMessage, keyboards.mainMenu);
    }
  }

  // Обработка кнопки "Главная страница"
  static async homePage(ctx: BotContext) {
    // Проверяем, является ли пользователь администратором
    const adminId = process.env.ADMIN_ID;
    const isAdmin = adminId && ctx.user_id?.toString() === adminId;

    const homeMessage = `
🏠 *Главная страница*

Выберите действие:
    `;
    
    // Показываем разные меню для админов и пользователей
    const menu = isAdmin ? keyboards.adminHomeMenu : keyboards.homeMenu;
    await ctx.replyWithHTML?.(homeMessage, menu);
  }

  // Обработка кнопки "Проверить чек"
  static async checkPage(ctx: BotContext) {
    const checkMessage = `
🔍 *Проверка банковского чека*

📎 Прикрепите PDF файл банковского чека для проверки подлинности через SafeCheck.

Система автоматически проанализирует документ и предоставит результат.
    `;
    
    await ctx.replyWithHTML?.(checkMessage);
  }

  // Обработка кнопки "История заявок" 
  static async historyPage(ctx: BotContext) {
    try {
      // Получаем последние проверки пользователя
      const actions = await ActionService.getUserActions(ctx.user_id!, 10);
      
      if (actions.length === 0) {
        await ctx.reply?.('📋 История заявок пуста');
        return;
      }

      let message = '📋 *История ваших заявок:*\n\n';
      
      actions.forEach((action: any, index: any) => {
        const date = action.created_at.toLocaleDateString('ru-RU');
        const time = action.created_at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        message += `${index + 1}. ${this.getActionIcon(action.action_type)} ${this.getActionName(action.action_type)}\n`;
        message += `📅 ${date} в ${time}\n`;
        if (action.data?.target_address || action.data?.address) {
          const address = action.data.target_address || action.data.address;
          message += `🎯 ${address.substring(0, 20)}...\n`;
        }
        message += `📊 Статус: ${action.result || 'Обработано'}\n\n`;
      });

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении истории заявок');
    }
  }

  // Обработка кнопки "Очистить чат"
  static async clearChat(ctx: BotContext) {
    try {
      const chatId = ctx.chat?.id;
      
      if (chatId) {
        // Получаем последние сохраненные сообщения
        const recentMessages = MessageService.getRecentMessages(chatId, 30);
        
        if (recentMessages.length > 0) {
          // Удаляем сохраненные сообщения
          const result = await MessageService.deleteMessages(ctx, chatId, recentMessages);
          
          // Очищаем историю сообщений
          MessageService.clearHistory(chatId);
          
          await ctx.reply?.(`🧹 Чат очищен! Удалено сообщений: ${result.success}`);
        } else {
          // Если нет сохраненных сообщений, пробуем удалить последние по ID
          const currentMessageId = ctx.message?.message_id;
          if (currentMessageId) {
            let deletedCount = 0;
            for (let i = 1; i <= 20; i++) {
              try {
                await ctx.telegram.deleteMessage(chatId, currentMessageId - i);
                deletedCount++;
              } catch (error) {
                // Игнорируем ошибки
                continue;
              }
            }
            await ctx.reply?.(`🧹 Чат очищен! Удалено сообщений: ${deletedCount}`);
          } else {
            await ctx.reply?.('🧹 Чат очищен!');
          }
        }
      }
      
      // Возвращаем главное меню
      setTimeout(async () => {
        await this.start(ctx);
      }, 1000);
      
    } catch (error) {
      console.error('Error clearing chat:', error);
      await ctx.reply?.('🧹 Чат очищен! (Некоторые сообщения могут остаться видимыми)');
      await this.start(ctx);
    }
  }

  private static getActionIcon(actionType: ActionType): string {
    switch (actionType) {
      case 'address_check': return '🔍';
      case 'tron_analysis': return '📊';
      case 'rapira_check': return '🛡️';
      case 'safecheck_receipt': return '📄';
      default: return '📋';
    }
  }

  private static getActionName(actionType: ActionType): string {
    switch (actionType) {
      case 'address_check': return 'Проверка адреса';
      case 'tron_analysis': return 'Tron анализ';
      case 'rapira_check': return 'Rapira проверка';
      case 'safecheck_receipt': return 'Проверка чека';
      default: return 'Неизвестное действие';
    }
  }

  static async help(ctx: BotContext) {
    const helpMessage = `
📖 *Справка по командам*

🔍 *Проверка адресов:*
/check &lt;адрес&gt; - Общая проверка безопасности
Пример: \`/check TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH\`

🔗 *Tron анализ:*
/tron &lt;адрес&gt; - Детальная информация о Tron адресе
Показывает баланс, токены, историю, оценку рисков

🛡️ *Rapira проверка:*
/rapira &lt;адрес|домен&gt; - Проверка через Rapira API
Обнаруживает вредоносные адреса и фишинговые сайты

📈 *Торговые данные:*
/rates - Биржевой курс USDT/RUB с Rapira
/orderbook - Стакан ордеров USDT/RUB

👤 *Профиль:*
/profile - Ваша информация и роль
/stats - Статистика ваших проверок

❓ *Поддержка:*
/support - Связь с администрацией

⚡ *Быстрые команды:*
Просто отправьте адрес или домен без команды - я автоматически его проверю!
    `;
    
    await ctx.replyWithHTML?.(helpMessage, keyboards.checkMenu);
  }

  static async check(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) {
      await ctx.reply?.('❌ Укажите адрес для проверки');
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 2) {
      await ctx.reply?.('❌ Укажите адрес: /check адрес');
      return;
    }

    const address = parts[1];
    await ctx.reply?.('🔍 Проверяю адрес...');

    try {
      // Создаем запрос
      const request = await ActionService.createRequest(
        ctx.user_id!,
        ActionType.SAFECHECK,
        { address }
      );

      // Выполняем проверку
      const result = await SafeCheckService.checkAddress(address);
      
      // Обновляем статус запроса
      await ActionService.completeRequest(request.id, result, ctx.user_id!);

      const statusIcon = result.is_safe ? '✅' : '⚠️';
      const riskLevel = result.risk_score < 30 ? 'Низкий' : 
                       result.risk_score < 60 ? 'Средний' : 'Высокий';

      let message = `
${statusIcon} *Результат проверки*

📍 Адрес: \`${address}\`
🛡️ Статус: ${result.is_safe ? 'Безопасный' : 'Подозрительный'}
📊 Оценка риска: ${result.risk_score}/100 (${riskLevel})
🕒 Проверено: ${result.last_checked.toLocaleString('ru-RU')}
📡 Источник: ${result.source}
      `;

      if (result.risk_factors.length > 0) {
        message += `\n⚠️ *Факторы риска:*\n`;
        result.risk_factors.forEach(factor => {
          message += `• ${factor}\n`;
        });
      }

      if (!result.is_safe) {
        message += `\n🚨 *Рекомендация:* Будьте осторожны при взаимодействии с этим адресом!`;
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при проверке адреса');
    }
  }

  static async tron(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) {
      await ctx.reply?.('❌ Укажите Tron адрес для анализа');
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 2) {
      await ctx.reply?.('❌ Укажите адрес: /tron <адрес>');
      return;
    }

    const address = parts[1];
    
    // Проверяем формат адреса
    const isValid = await TronService.validateAddress(address);
    if (!isValid) {
      await ctx.reply?.('❌ Неверный формат Tron адреса');
      return;
    }

    await ctx.reply?.('📊 Анализирую Tron адрес...');

    try {
      const request = await ActionService.createRequest(
        ctx.user_id!,
        ActionType.TRON_CHECK,
        { address }
      );

      const accountInfo = await TronService.getAccountInfo(address);
      await ActionService.completeRequest(request.id, accountInfo, ctx.user_id!);

      const balanceInTrx = (accountInfo.balance / 1000000).toFixed(6);
      const riskIcon = accountInfo.risk_assessment?.level === 'LOW' ? '🟢' :
                      accountInfo.risk_assessment?.level === 'MEDIUM' ? '🟡' :
                      accountInfo.risk_assessment?.level === 'HIGH' ? '🟠' : '🔴';

      let message = `
📊 *Анализ Tron адреса*

📍 Адрес: \`${address}\`
💰 Баланс TRX: ${balanceInTrx} TRX
📅 Создан: ${accountInfo.created_time.toLocaleDateString('ru-RU')}
📈 Транзакций: ${accountInfo.transactions_count}
      `;

      if (accountInfo.last_operation_time) {
        message += `🕒 Последняя активность: ${accountInfo.last_operation_time.toLocaleDateString('ru-RU')}\n`;
      }

      if (accountInfo.trc20_balances.length > 0) {
        message += `\n💎 *TRC20 токены:*\n`;
        accountInfo.trc20_balances.slice(0, 5).forEach(token => {
          const balance = (parseFloat(token.balance) / Math.pow(10, token.decimals)).toFixed(2);
          message += `• ${token.token_symbol}: ${balance}\n`;
        });
        if (accountInfo.trc20_balances.length > 5) {
          message += `• ...и еще ${accountInfo.trc20_balances.length - 5} токенов\n`;
        }
      }

      if (accountInfo.risk_assessment) {
        message += `\n${riskIcon} *Оценка рисков:*\n`;
        message += `📊 Уровень: ${accountInfo.risk_assessment.level}\n`;
        message += `🎯 Оценка: ${accountInfo.risk_assessment.score}/100\n`;
        
        if (accountInfo.risk_assessment.factors.length > 0) {
          message += `⚠️ Факторы риска:\n`;
          accountInfo.risk_assessment.factors.forEach(factor => {
            message += `• ${factor}\n`;
          });
        }

        if (accountInfo.risk_assessment.recommendations.length > 0) {
          message += `💡 Рекомендации:\n`;
          accountInfo.risk_assessment.recommendations.forEach(rec => {
            message += `• ${rec}\n`;
          });
        }
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при анализе Tron адреса');
    }
  }

  static async rapira(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text) {
      await ctx.reply?.('❌ Укажите адрес или домен для проверки');
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 2) {
      await ctx.reply?.('❌ Укажите цель: /rapira <адрес|домен>');
      return;
    }

    const target = parts[1];
    const type = target.includes('.') ? 'domain' : 'address';
    
    await ctx.reply?.('🛡️ Проверяю через Rapira...');

    try {
      const request = await ActionService.createRequest(
        ctx.user_id!,
        ActionType.RAPIRA_CHECK,
        { target, type }
      );

      const result = await RapiraService.checkTarget(target, type);
      await ActionService.completeRequest(request.id, result, ctx.user_id!);

      const statusIcon = result.is_malicious ? '🚨' : '✅';
      const threatLevel = result.threat_level < 30 ? 'Низкий' :
                         result.threat_level < 60 ? 'Средний' : 'Высокий';

      let message = `
${statusIcon} *Rapira проверка*

🎯 Цель: \`${target}\`
📋 Тип: ${type === 'domain' ? 'Домен' : 'Адрес'}
🛡️ Статус: ${result.is_malicious ? 'ВРЕДОНОСНЫЙ' : 'Безопасный'}
⚡ Уровень угрозы: ${result.threat_level}/100 (${threatLevel})
📝 Описание: ${result.description}
      `;

      if (result.categories.length > 0) {
        message += `\n🏷️ *Категории:*\n`;
        result.categories.forEach(category => {
          message += `• ${category}\n`;
        });
      }

      if (result.last_seen) {
        message += `\n🕒 Последнее обнаружение: ${result.last_seen.toLocaleDateString('ru-RU')}`;
      }

      message += `\n📡 Источники: ${result.sources.join(', ')}`;

      if (result.is_malicious) {
        message += `\n\n🚨 *ВНИМАНИЕ!* Обнаружена угроза. Избегайте взаимодействия!`;
      }

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при проверке через Rapira');
    }
  }

  static async rates(ctx: BotContext) {
    try {
      const ratesMessage = ExchangeRateService.getFormattedRates();
      await ctx.replyWithHTML?.(ratesMessage);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении курсов валют');
    }
  }

  static async orderbook(ctx: BotContext) {
    const symbol = 'USDT/RUB'; // Фиксированная пара как в прошлом проекте

    await ctx.reply?.(`📊 Получаю стакан ордеров для ${symbol}...`);

    try {
      const orderBook = await RapiraService.getOrderBook(symbol);
      
      if (!orderBook) {
        await ctx.reply?.('❌ Не удалось получить стакан ордеров');
        return;
      }

      let message = `📊 *Стакан ордеров ${symbol}*\n\n`;
      
      message += `🔴 *Продажа (Ask):*\n`;
      orderBook.asks.slice(0, 5).reverse().forEach(ask => {
        message += `${ask.price.toFixed(2)} - ${ask.quantity.toLocaleString('ru-RU')}\n`;
      });
      
      message += `\n🟢 *Покупка (Bid):*\n`;
      orderBook.bids.slice(0, 5).forEach(bid => {
        message += `${bid.price.toFixed(2)} - ${bid.quantity.toLocaleString('ru-RU')}\n`;
      });

      const spread = orderBook.asks[0] && orderBook.bids[0] ? 
        (orderBook.asks[0].price - orderBook.bids[0].price).toFixed(2) : 'N/A';
      
      message += `\n💹 *Спред:* ${spread}\n`;
      message += `🕒 Время: ${new Date(orderBook.timestamp).toLocaleString('ru-RU')}`;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении стакана ордеров');
    }
  }

  static async profile(ctx: BotContext) {
    try {
      const user = await import('../services/userService').then(m => m.UserService.getUserById(ctx.user_id!));
      const role = await import('../services/userService').then(m => m.UserService.getUserRole(ctx.user_id!));
      
      if (!user) {
        await ctx.reply?.('❌ Пользователь не найден');
        return;
      }

      const message = `
👤 *Ваш профиль*

🆔 ID: ${user.id}
👤 Имя: ${user.first_name || 'Не указано'}
📱 Username: ${user.username ? '@' + user.username : 'Не указано'}
🏷️ Роль: ${role?.name || 'Не назначена'}
📅 Регистрация: ${user.registered_at.toLocaleDateString('ru-RU')}
🕒 Последняя активность: ${user.last_activity.toLocaleDateString('ru-RU')}

🔐 *Разрешения:*
${role?.permissions.map(p => `• ${p.name}`).join('\n') || 'Нет разрешений'}
      `;

      await ctx.replyWithHTML?.(message, keyboards.profileMenu);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении профиля');
    }
  }

  static async stats(ctx: BotContext) {
    try {
      const requests = await ActionService.getUserRequests(ctx.user_id!);
      
      const totalRequests = requests.length;
      const completedRequests = requests.filter(r => r.status === 'completed').length;
      const failedRequests = requests.filter(r => r.status === 'failed').length;
      
      const safeCheckCount = requests.filter(r => r.action_type === ActionType.SAFECHECK).length;
      const tronCheckCount = requests.filter(r => r.action_type === ActionType.TRON_CHECK).length;
      const rapiraCheckCount = requests.filter(r => r.action_type === ActionType.RAPIRA_CHECK).length;

      const message = `
📊 *Ваша статистика*

📈 Всего запросов: ${totalRequests}
✅ Успешно: ${completedRequests}
❌ Ошибок: ${failedRequests}

🔍 *По типам проверок:*
• SafeCheck: ${safeCheckCount}
• Tron анализ: ${tronCheckCount}
• Rapira: ${rapiraCheckCount}

${totalRequests > 0 ? 
  `📅 Последний запрос: ${requests[0]?.created_at.toLocaleDateString('ru-RU')}` : 
  '📅 Запросов пока нет'
}
      `;

      await ctx.replyWithHTML?.(message);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка при получении статистики');
    }
  }

  static async support(ctx: BotContext) {
    const message = `
🆘 *Поддержка*

📞 Если у вас возникли вопросы или проблемы:

1. Проверьте /help для справки по командам
2. Убедитесь, что адрес введен корректно
3. Попробуйте повторить запрос через несколько минут

👨‍💻 Для связи с администрацией отправьте сообщение с описанием проблемы, начинающееся с #support

📋 Пример: 
\`#support Не работает команда /check\`

⚡ Мы ответим в ближайшее время!
    `;
    
    await ctx.replyWithHTML?.(message);
  }

  static async handleText(ctx: BotContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!text || text.startsWith('/') || text.startsWith('#')) {
      return;
    }

    // Автоматическая проверка адреса/домена
    const trimmedText = InputValidator.sanitizeInput(text);
    const addressType = InputValidator.detectAddressType(trimmedText);
    
    if (addressType === 'unknown') {
      return; // Не реагируем на неизвестные типы
    }

    await ctx.reply?.('🔍 Автоматическая проверка...');
    
    try {
      let result;
      let message = '';

      switch (addressType) {
        case 'domain':
          result = await RapiraService.checkTarget(trimmedText, 'domain');
          message = MessageFormatter.formatCheckResult(result, 'rapira');
          break;
        case 'tron':
          const validation = TronService.validateAddress ? 
            await TronService.validateAddress(trimmedText) : 
            InputValidator.validateTronAddress(trimmedText).isValid;
          
          if (validation) {
            result = await TronService.getAccountInfo(trimmedText);
            message = MessageFormatter.formatCheckResult(result, 'tron');
          } else {
            await ctx.reply?.('❌ Неверный формат Tron адреса');
            return;
          }
          break;
        default:
          result = await SafeCheckService.checkAddress(trimmedText);
          message = MessageFormatter.formatCheckResult(result, 'safecheck');
      }

      await ActionService.createRequest(ctx.user_id!, ActionType.SAFECHECK, { 
        address: trimmedText, 
        auto: true,
        type: addressType 
      });
      
      await ctx.replyWithHTML?.(message, keyboards.quickActions);
    } catch (error) {
      await ctx.reply?.('❌ Ошибка автоматической проверки');
    }
  }
}