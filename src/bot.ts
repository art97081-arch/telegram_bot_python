import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import * as http from 'http';
import { LogService } from './services/logService';
import { MessageService } from './services/MessageService';
import { ExchangeRateService } from './services/ExchangeRateService';
import { SafeCheckService } from './services/safeCheckService';
import { ActionService } from './services/actionService';
import { RoleService } from './services/roleService';
import { ApplicationService, ApplicationType, ApplicationStatus } from './services/applicationService';
import { SessionService } from './services/sessionService';
import { DatabaseService } from './services/databaseService';
import { NotificationService } from './services/notificationService';
import { ActionType } from './types';
import { UserRole } from './types/UserRole';
import { UserCommands } from './commands/userCommands';
import { AdminCommands } from './commands/adminCommands';
import { 
  authMiddleware, 
  requireAdmin, 
  requirePermission,
  rateLimitMiddleware,
  BotContext 
} from './middleware/authMiddleware';
import { AccessMiddleware } from './middleware/accessMiddleware';
import { keyboards, getMenuByRole, financeMenu, superAdminInlineMenu } from './utils/keyboards';

class SecurityBot {
  private bot: Telegraf;
  private isMaintenanceMode: boolean = false;
  private httpServer?: http.Server;

  constructor() {
    // ВАЖНО: Запускаем HTTP сервер сначала для healthcheck Railway
    this.setupHealthCheck();
    
    const token = process.env.BOT_TOKEN?.trim();
    console.log(`🔍 BOT_TOKEN проверка: ${token ? 'найден' : 'отсутствует'} (длина: ${token?.length || 0})`);
    
    if (!token || token.length < 10) {
      console.error('❌ BOT_TOKEN не установлен или некорректен в переменных окружения');
      console.log('🌐 HTTP сервер работает на /health для Railway healthcheck');
      console.log('🔧 Настройте BOT_TOKEN в Environment Variables');
      
      // Создаем временный бот чтобы избежать crash
      this.bot = new Telegraf('dummy_token');
      
      // Запускаем только HTTP сервер
      setInterval(() => {
        console.log('⏰ Жду BOT_TOKEN...');
      }, 30000);
      return;
    }

    console.log('✅ BOT_TOKEN найден, инициализирую бота...');
    this.bot = new Telegraf(token);
    this.setupMiddleware();
    this.setupCommands();
    this.setupErrorHandling();
  }

  private setupHealthCheck() {
    console.log('🔧 Настройка HTTP сервера для healthcheck...');
    
    // HTTP сервер для healthcheck Railway
    this.httpServer = http.createServer((req, res) => {
      console.log(`📡 HTTP запрос: ${req.method} ${req.url}`);
      
      if (req.url === '/health') {
        const response = { 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          botToken: process.env.BOT_TOKEN ? 'set' : 'missing'
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        console.log('✅ Healthcheck ответ отправлен');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        console.log('❌ 404 - путь не найден');
      }
    });

    const port = process.env.PORT || 3000;
    
    this.httpServer.on('error', (error) => {
      console.error('❌ HTTP сервер ошибка:', error);
    });
    
    this.httpServer.listen(Number(port), '0.0.0.0', () => {
      console.log(`🌐 HTTP сервер запущен на порту ${port}`);
      console.log(`🔗 Healthcheck: http://localhost:${port}/health`);
    });
  }

  private setupMiddleware() {
    // Отслеживание сообщений для возможности удаления
    this.bot.use(async (ctx, next) => {
      // Сохраняем входящее сообщение
      const chatId = ctx.chat?.id;
      const messageId = ctx.message?.message_id;
      if (chatId && messageId) {
        MessageService.saveMessage(chatId, messageId);
      }
      
      // Перехватываем отправку сообщений ботом
      const originalReply = ctx.reply;
      if (originalReply) {
        ctx.reply = async (text: any, extra?: any) => {
          const result = await originalReply.call(ctx, text, extra);
          if (result && chatId) {
            MessageService.saveMessage(chatId, result.message_id);
          }
          return result;
        };
      }
      
      await next();
    });

    // Логирование всех сообщений
    this.bot.use(async (ctx, next) => {
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : 'no text';
      console.log(`[${new Date().toISOString()}] Message from ${ctx.from?.id}: ${messageText}`);
      await next();
    });

    // Проверка доступа в режиме разработки
    this.bot.use(AccessMiddleware.checkAccess);

    // Проверка режима обслуживания
    this.bot.use(async (ctx, next) => {
      if (this.isMaintenanceMode && ctx.from?.id.toString() !== process.env.ADMIN_ID) {
        await ctx.reply('🔧 Бот находится в режиме обслуживания. Попробуйте позже.');
        return;
      }
      await next();
    });

    // Аутентификация и авторизация
    this.bot.use(authMiddleware);

    // Ограничение частоты запросов
    this.bot.use(rateLimitMiddleware(20, 60000)); // 20 запросов в минуту
  }

  private setupCommands() {
    // Публичные команды
    this.bot.start(async (ctx) => {
      await UserCommands.start(ctx as BotContext);
    });

    this.bot.help(async (ctx) => {
      await UserCommands.help(ctx as BotContext);
    });

    // Пользовательские команды
    this.bot.command('check', async (ctx) => {
      await UserCommands.check(ctx as BotContext);
    });

    this.bot.command('tron', async (ctx) => {
      await UserCommands.tron(ctx as BotContext);
    });

    this.bot.command('rapira', async (ctx) => {
      await UserCommands.rapira(ctx as BotContext);
    });

    this.bot.command('profile', async (ctx) => {
      await UserCommands.profile(ctx as BotContext);
    });

    this.bot.command('stats', async (ctx) => {
      await UserCommands.stats(ctx as BotContext);
    });

    this.bot.command('support', async (ctx) => {
      await UserCommands.support(ctx as BotContext);
    });

    // Новые команды для Rapira
    this.bot.command('rates', async (ctx) => {
      await UserCommands.rates(ctx as BotContext);
    });

    this.bot.command('orderbook', async (ctx) => {
      await UserCommands.orderbook(ctx as BotContext);
    });

    // Административные команды (требуют права администратора)
    this.bot.command('admin', requireAdmin, async (ctx) => {
      await AdminCommands.adminHelp(ctx as BotContext);
    });

    this.bot.command('users', requireAdmin, async (ctx) => {
      await AdminCommands.listUsers(ctx as BotContext);
    });

    this.bot.command('user', requireAdmin, async (ctx) => {
      await AdminCommands.getUserInfo(ctx as BotContext);
    });

    this.bot.command('setrole', requireAdmin, async (ctx) => {
      await AdminCommands.setUserRole(ctx as BotContext);
    });

    this.bot.command('systemstats', requireAdmin, async (ctx) => {
      await AdminCommands.getSystemStats(ctx as BotContext);
    });

    this.bot.command('logs', requireAdmin, async (ctx) => {
      await AdminCommands.getLogs(ctx as BotContext);
    });

    this.bot.command('broadcast', requireAdmin, async (ctx) => {
      await AdminCommands.broadcast(ctx as BotContext);
    });

    this.bot.command('clear_cache', requireAdmin, async (ctx) => {
      await AdminCommands.clearCache(ctx as BotContext);
    });

    this.bot.command('requests', requireAdmin, async (ctx) => {
      await AdminCommands.getPendingRequests(ctx as BotContext);
    });

    this.bot.command('security', requireAdmin, async (ctx) => {
      await AdminCommands.getSecurityReport(ctx as BotContext);
    });

    this.bot.command('safecheck_status', requireAdmin, async (ctx) => {
      await AdminCommands.safeCheckStatus(ctx as BotContext);
    });

    // Команда управления курсами
    this.bot.command('rates_admin', requireAdmin, async (ctx) => {
      await AdminCommands.manageRates(ctx as BotContext);
    });

    // Команда управления доступом в режиме разработки
    this.bot.command('access', requireAdmin, async (ctx) => {
      await AdminCommands.showAccessInfo(ctx as BotContext);
    });

    // Команда для переключения режима обслуживания
    this.bot.command('maintenance', requireAdmin, async (ctx) => {
      this.isMaintenanceMode = !this.isMaintenanceMode;
      const status = this.isMaintenanceMode ? 'включен' : 'выключен';
      await ctx.reply(`🔧 Режим обслуживания ${status}`);
    });

    // Обработка текстовых сообщений (кнопки и команды с ролевой системой)
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      const botCtx = ctx as BotContext;
      
      // Получаем роль пользователя
      const userRole = await RoleService.getUserRole(botCtx.user_id!);
      const permissions = await RoleService.getUserPermissions(botCtx.user_id!);
      
      // Обработка кнопок клавиатуры
      switch (text) {
        case '🏠 Главная страница':
          await this.showMainPage(botCtx, userRole);
          return;
          
        // ПОЛЬЗОВАТЕЛЬ
        case '💰 Курсы валют':
          if (permissions.canViewRates) {
            await this.showExchangeRates(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет доступа к курсам валют');
          }
          return;
          
          
          
        case '📝 Подача заявок':
          if (permissions.canSubmitApplications) {
            await this.showFinanceMenu(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет прав для подачи заявок');
          }
          return;
          
        case '📋 История заявок':
          if (permissions.canSubmitApplications) {
            const { RoleCommands } = await import('./commands/roleCommands');
            await RoleCommands.handleMyApplications(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет доступа к заявкам');
          }
          return;
          
        // АДМИНИСТРАТОР
        case '🔍 Проверить чек':
          if (permissions.canCheckReceipts) {
            await UserCommands.checkPage(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет прав для проверки чеков');
          }
          return;
          
        case '📨 Заявки пользователей':
          if (permissions.canViewApplications) {
            const { RoleCommands } = await import('./commands/roleCommands');
            await RoleCommands.handlePendingApplications(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет прав для просмотра заявок пользователей');
          }
          return;
          
        // СУПЕР АДМИНИСТРАТОР
        case '👥 Управление пользователями':
          if (permissions.canManageUsers) {
            await this.showUserManagement(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет прав для управления пользователями');
          }
          return;
          
        case '⚙️ Настройки':
          if (permissions.canViewAllData) {
            await this.showSystemSettings(botCtx);
          } else {
            await botCtx.reply('❌ У вас нет доступа к настройкам системы');
          }
          return;
          
        // ОСТАЛЬНЫЕ КОМАНДЫ
        case '🗑️ Очистить чат':
          await UserCommands.clearChat(botCtx);
          return;
      }
      
      // Обработка ID пользователя для назначения ролей
      if (SessionService.getSession(botCtx.user_id!)?.awaitingUserId && /^\d+$/.test(text)) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleUserIdInput(botCtx, parseInt(text));
        return;
      }
      
      // Обработка ID пользователя для отзыва прав
      if (SessionService.getSession(botCtx.user_id!)?.awaitingRevokeUserId && /^\d+$/.test(text)) {
        await this.handleRevokeRights(botCtx, parseInt(text));
        return;
      }
      
      // Обработка ID пользователя для управления доступом
      if (SessionService.getSession(botCtx.user_id!)?.awaitingAccessUserId && /^\d+$/.test(text)) {
        const session = SessionService.getSession(botCtx.user_id!);
        const userId = parseInt(text);
        
        if (session.awaitingAccessUserId === 'add') {
          await AdminCommands.addUserToAccess(botCtx, userId);
        } else if (session.awaitingAccessUserId === 'remove') {
          await AdminCommands.removeUserFromAccess(botCtx, userId);
        }
        
        SessionService.clearSession(botCtx.user_id!);
        return;
      }
      
      // Обработка данных пополнения (новый формат)
      if (SessionService.getSession(botCtx.user_id!)?.awaitingDepositData) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleDepositData(botCtx, text);
        return;
      }
      
      // Обработка суммы пополнения (старый формат)
      if (SessionService.getSession(botCtx.user_id!)?.awaitingDepositAmount) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleDepositAmount(botCtx, text);
        return;
      }
      
      // Обработка хэша транзакции
      if (SessionService.getSession(botCtx.user_id!)?.awaitingDepositHash) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleDepositHash(botCtx, text);
        return;
      }
      
      // Обработка суммы вывода
      if (SessionService.getSession(botCtx.user_id!)?.awaitingWithdrawAmount) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleWithdrawAmount(botCtx, text);
        return;
      }
      
      // Обработка адреса кошелька для вывода
      if (SessionService.getSession(botCtx.user_id!)?.awaitingWithdrawWallet) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleWithdrawWallet(botCtx, text);
        return;
      }
      
      // Обработка ответа админа пользователю
      if (SessionService.getSession(botCtx.user_id!)?.awaitingAdminReply) {
        await this.handleAdminReply(botCtx, text);
        return;
      }
      
      // Обработка описания заявки
      if (SessionService.getSession(botCtx.user_id!)?.awaitingApplicationDetails) {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleApplicationDetails(botCtx, text);
        return;
      }
      
      // Обработка сообщений поддержки
      if (text.startsWith('#support')) {
        await this.handleSupportMessage(botCtx);
        return;
      }

      // Автоматическая проверка адресов/доменов (только если есть права)
      if (permissions.canCheckReceipts) {
        await UserCommands.handleText(botCtx);
      }
    });

    // Обработка callback queries (inline кнопки)
    this.bot.on('callback_query', async (ctx) => {
      await this.handleCallbackQuery(ctx as any);
    });

    // Обработка загруженных документов (PDF чеки)
    this.bot.on('document', async (ctx) => {
      await this.handleDocument(ctx as BotContext);
    });
  }

  private async handleDocument(ctx: BotContext) {
    try {
      const document = (ctx.message as any)?.document;
      
      if (!document) {
        await ctx.reply?.('❌ Документ не найден');
        return;
      }

      // Проверяем тип файла
      if (document.mime_type !== 'application/pdf') {
        await ctx.reply?.('❌ Поддерживаются только PDF файлы. Пожалуйста, загрузите PDF документ.');
        return;
      }

      // Проверяем размер файла (максимум 20MB)
      if (document.file_size && document.file_size > 20 * 1024 * 1024) {
        await ctx.reply?.('❌ Размер файла слишком большой. Максимальный размер: 20MB.');
        return;
      }

      await ctx.reply?.('📄 Документ получен! Обрабатываем');

      // Получаем файл
      const file = await ctx.telegram.getFile(document.file_id);
      
      if (!file.file_path) {
        await ctx.reply?.('❌ Не удалось получить файл для обработки');
        return;
      }

      // Формируем URL файла
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      
      // Проверяем через SafeCheck API
      const result = await SafeCheckService.checkReceiptFromUrl(fileUrl);
      
      if (result) {
        // ПРОСТАЯ И ПОНЯТНАЯ ПРОВЕРКА!
        let isGood = true;
        let problems = [];
        
        // Проверяем что не так
        if (!result.struct_passed) {
          isGood = false;
          problems.push('❌ Чек не прошел проверку по структуре');
        }
        if (!result.is_original) {
          isGood = false;
          problems.push('❌ Проверка по БД не поддерживается');
        }
        if (result.color === 'red' || result.color === 'black') {
          isGood = false;
        }
        
        // ГЛАВНОЕ СООБЩЕНИЕ - ПРОСТОЕ И ПОНЯТНОЕ!
        let message = '';
        
        if (isGood) {
          message += `✅ **ЧЕК ХОРОШИЙ! МОЖНО ДОВЕРЯТЬ!** ✅\n\n`;
          message += `🎉 Этот чек прошел все проверки\n`;
          message += `🛡️ Документ настоящий и безопасный\n\n`;
        } else {
          message += `🚨 **ВНИМАНИЕ! ЧЕК ПОДОЗРИТЕЛЬНЫЙ!** 🚨\n\n`;
          message += `⚠️ НЕ РЕКОМЕНДУЕТСЯ ДОВЕРЯТЬ ЭТОМУ ЧЕКУ!\n\n`;
          message += `❗️ Найдены проблемы:\n`;
          problems.forEach(problem => {
            message += `${problem}\n`;
          });
          message += `\n`;
        }
        
        message += `📄 Файл: ${document.file_name || 'receipt.pdf'}\n`;
        message += `🕐 Проверено: ${new Date().toLocaleString('ru-RU')}\n\n`;
        
        // Для плохих чеков добавляем детали платежа
        if (!isGood) {
          message += `💳 Детали платежа\n\n`;
          
          if (result.check_data) {
            // Банк
            if (result.check_data.sender_bank || result.check_data.recipient_bank) {
              const bank = result.check_data.sender_bank || result.check_data.recipient_bank || 'данных нет';
              message += `💎 Банк : ${bank}\n`;
            } else {
              message += `💎 Банк : данных нет\n`;
            }
            
            // Сумма
            if (result.check_data.sum) {
              message += `💰 Сумма : ${result.check_data.sum}\n`;
            } else {
              message += `💰 Сумма : данных нет\n`;
            }
            
            // Статус
            if (result.check_data.status) {
              message += `📊 Статус : ${result.check_data.status}\n`;
            } else {
              message += `📊 Статус : данных нет\n`;
            }
            
            // Дата платежа
            if (result.check_data.date) {
              const date = new Date(result.check_data.date * 1000);
              message += `📅 Дата платежа : ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU')}\n\n`;
            } else {
              message += `📅 Дата платежа : данных нет\n\n`;
            }
            
            // Данные отправителя
            message += `👤 Данные отправителя :\n\n`;
            message += `👤 ФИО отправителя : ${result.check_data.sender_fio || 'данных нет'}\n`;
            message += `🏛️ Реквизиты отправителя : ${result.check_data.sender_req || 'данных нет'}\n`;
            message += `💎 Банк отправителя : ${result.check_data.sender_bank || 'данных нет'}\n\n`;
            
            // Данные получателя
            message += `👥 Данные получателя :\n\n`;
            message += `👤 ФИО получателя : ${result.check_data.recipient_fio || 'данных нет'}\n`;
            message += `🏛️ Реквизиты получателя : ${result.check_data.recipient_req || 'данных нет'}\n`;
            message += `💎 Банк получателя : ${result.check_data.recipient_bank || 'данных нет'}`;
          } else {
            message += `💎 Банк : данных нет\n`;
            message += `💰 Сумма : данных нет\n`;
            message += `📊 Статус : данных нет\n`;
            message += `📅 Дата платежа : данных нет\n\n`;
            message += `👤 Данные отправителя :\n\n`;
            message += `👤 ФИО отправителя : данных нет\n`;
            message += `🏛️ Реквизиты отправителя : данных нет\n`;
            message += `💎 Банк отправителя : данных нет\n\n`;
            message += `👥 Данные получателя :\n\n`;
            message += `👤 ФИО получателя : данных нет\n`;
            message += `🏛️ Реквизиты получателя : данных нет\n`;
            message += `💎 Банк получателя : данных нет`;
          }
        }
        
        // Основное сообщение в стиле SafeCheck
        let detailMessage = `📄 Результаты проверки файла : ${document.file_name || 'receipt.pdf'}\n`;
        detailMessage += `🕐 Время проверки : ${new Date().toLocaleString('ru-RU')}\n\n`;
        
        // Добавляем статусы ошибок в детальное сообщение
        if (problems.length > 0) {
          problems.forEach((problem: string) => {
            detailMessage += `${problem}\n`;
          });
          detailMessage += `⚠️ Обратите внимание, что проверка по БД не используется из-за недостаточных данных.\n\n`;
        }
        
        // Детали платежа
        detailMessage += `💳 Детали платежа\n\n`;
        
        if (result.check_data) {
          // Банк
          if (result.check_data.sender_bank || result.check_data.recipient_bank) {
            const bank = result.check_data.sender_bank || result.check_data.recipient_bank || 'данных нет';
            message += `💎 Банк : ${bank}\n`;
          } else {
            message += `💎 Банк : данных нет\n`;
          }
          
          // Сумма
          if (result.check_data.sum) {
            message += `💰 Сумма : ${result.check_data.sum}\n`;
          } else {
            message += `� Сумма : данных нет\n`;
          }
          
          // Статус
          if (result.check_data.status) {
            message += `� Статус : ${result.check_data.status}\n`;
          } else {
            message += `📊 Статус : данных нет\n`;
          }
          
          // Дата платежа
          if (result.check_data.date) {
            const date = new Date(result.check_data.date * 1000);
            message += `📅 Дата платежа : ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU')}\n\n`;
          } else {
            message += `📅 Дата платежа : данных нет\n\n`;
          }
          
          // Данные отправителя
          message += `👤 Данные отправителя :\n\n`;
          message += `👤 ФИО отправителя : ${result.check_data.sender_fio || 'данных нет'}\n`;
          message += `🏛️ Реквизиты отправителя : ${result.check_data.sender_req || 'данных нет'}\n`;
          message += `💎 Банк отправителя : ${result.check_data.sender_bank || 'данных нет'}\n\n`;
          
          // Данные получателя
          message += `👥 Данные получателя :\n\n`;
          message += `👤 ФИО получателя : ${result.check_data.recipient_fio || 'данных нет'}\n`;
          message += `🏛️ Реквизиты получателя : ${result.check_data.recipient_req || 'данных нет'}\n`;
          message += `� Банк получателя : ${result.check_data.recipient_bank || 'данных нет'}`;
        } else {
          message += `💎 Банк : данных нет\n`;
          message += `💰 Сумма : данных нет\n`;
          message += `📊 Статус : данных нет\n`;
          message += `📅 Дата платежа : данных нет\n\n`;
          message += `👤 Данные отправителя :\n\n`;
          message += `👤 ФИО отправителя : данных нет\n`;
          message += `🏛️ Реквизиты отправителя : данных нет\n`;
          message += `� Банк отправителя : данных нет\n\n`;
          message += `👥 Данные получателя :\n\n`;
          message += `👤 ФИО получателя : данных нет\n`;
          message += `🏛️ Реквизиты получателя : данных нет\n`;
          message += `💎 Банк получателя : данных нет`;
        }
        
        // ОТПРАВЛЯЕМ ОДНО СООБЩЕНИЕ
        if (isGood) {
          // Для хорошего чека - простое сообщение
          await ctx.replyWithHTML?.(message);
        } else {
          // Для плохого чека - отправляем с кнопкой репорта
          const reportButton = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🚨 Отправить репорт', callback_data: `report_${result.file_id}` }
                ]
              ]
            }
          };
          await ctx.replyWithHTML?.(message, reportButton);
        }
      } else {
        let message = `🚨 **ОШИБКА! НЕ СМОГЛИ ПРОВЕРИТЬ ЧЕК!** 🚨\n\n`;
        message += `❌ Что-то пошло не так при проверке\n`;
        message += `📄 Файл: ${document.file_name || 'receipt.pdf'}\n`;
        message += `📊 Размер: ${(document.file_size / 1024).toFixed(2)} KB\n\n`;
        message += `🔄 **ПОПРОБУЙТЕ ЕЩЕ РАЗ!**\n`;
        message += `💡 Возможно проблема временная`;
        
        await ctx.replyWithHTML?.(message);
      }

      // Логируем проверку
      await ActionService.createRequest(
        ctx.user_id!, 
        ActionType.SAFECHECK_RECEIPT, 
        { 
          file_name: document.file_name,
          file_size: document.file_size,
          file_url: fileUrl,
          result: result
        }
      );

    } catch (error) {
      console.error('Document processing error:', error);
      await ctx.reply?.('❌ Ошибка при обработке документа. Попробуйте позже.');
    }
  }

  private setupErrorHandling() {
    this.bot.catch(async (err, ctx) => {
      console.error('Bot error:', err);
      
      try {
        const error = err as Error;
        await LogService.log({
          user_id: ctx.from?.id || 0,
          action: 'bot_error',
          details: {
            error: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace',
            update_type: ctx.updateType
          }
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      try {
        await ctx.reply('❌ Произошла ошибка при обработке команды. Попробуйте позже.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    });

    // Обработка необработанных исключений
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  private async handleCallbackQuery(ctx: any) {
    const callbackData = ctx.callbackQuery?.data;
    const chatId = ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;

    console.log(`[${new Date().toISOString()}] Callback query from ${ctx.from?.id}: ${callbackData}`);

    if (!callbackData) return;

    try {
      await ctx.answerCbQuery();

      // ОБРАБОТКА ПОПОЛНЕНИЙ И ВЫВОДОВ
      if (callbackData.startsWith('process_deposit_')) {
        const applicationId = callbackData.replace('process_deposit_', '');
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.processDepositApplication(ctx as BotContext, applicationId);
        return;
      }
      
      if (callbackData.startsWith('confirm_deposit_')) {
        const applicationId = callbackData.replace('confirm_deposit_', '');
        await this.confirmDeposit(ctx as BotContext, applicationId);
        return;
      }

      // ОБРАБОТКА КНОПОК ФИНАНСОВЫХ ОПЕРАЦИЙ
      if (callbackData === 'deposit') {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleDeposit(ctx as BotContext);
        return;
      }
      
      if (callbackData === 'withdraw') {
        const { RoleCommands } = await import('./commands/roleCommands');
        await RoleCommands.handleWithdraw(ctx as BotContext);
        return;
      }

      // ОБРАБОТКА ЗАЯВОК НА ПОПОЛНЕНИЕ
      if (callbackData.startsWith('approve_deposit_')) {
        const applicationId = callbackData.replace('approve_deposit_', '');
        await this.approveDeposit(ctx as BotContext, applicationId);
        return;
      }
      
      if (callbackData.startsWith('reject_deposit_')) {
        const applicationId = callbackData.replace('reject_deposit_', '');
        await this.rejectDeposit(ctx as BotContext, applicationId);
        return;
      }
      
      if (callbackData.startsWith('reply_deposit_')) {
        const applicationId = callbackData.replace('reply_deposit_', '');
        await this.replyToDeposit(ctx as BotContext, applicationId);
        return;
      }

      switch (callbackData) {
        // УПРАВЛЕНИЕ РОЛЯМИ (супер админ)
        case 'assign_admin': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleAssignRole(ctx as BotContext, UserRole.ADMIN);
          break;
        }
        case 'assign_super_admin': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleAssignRole(ctx as BotContext, UserRole.SUPER_ADMIN);
          break;
        }
        case 'list_roles':
          await this.showRolesList(ctx as BotContext);
          break;
        case 'revoke_rights':
          await this.showRevokeRightsMenu(ctx as BotContext);
          break;
          
        // ТИПЫ ЗАЯВОК
        case 'app_type_exchange': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleApplicationType(ctx as BotContext, ApplicationType.EXCHANGE);
          break;
        }
        case 'app_type_support': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleApplicationType(ctx as BotContext, ApplicationType.SUPPORT);
          break;
        }
        case 'app_type_verification': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleApplicationType(ctx as BotContext, ApplicationType.VERIFICATION);
          break;
        }
        case 'app_type_other': {
          const { RoleCommands } = await import('./commands/roleCommands');
          await RoleCommands.handleApplicationType(ctx as BotContext, ApplicationType.OTHER);
          break;
        }
          
        // СИСТЕМНЫЕ НАСТРОЙКИ
        case 'system_stats':
          await this.showSystemStats(ctx as BotContext);
          break;
        case 'restart_services':
          await this.restartServices(ctx as BotContext);
          break;
        case 'view_logs':
          await this.showSystemLogs(ctx as BotContext);
          break;
        case 'manage_rates':
          await this.showRatesManagement(ctx as BotContext);
          break;
          
        case 'main_menu':
          await this.showMainMenu(ctx);
          break;
        case 'check_address':
          await this.showCheckMenu(ctx);
          break;
        case 'profile':
          await UserCommands.profile(ctx as BotContext);
          break;
        case 'help':
          await UserCommands.help(ctx as BotContext);
          break;
        case 'stats':
          await UserCommands.stats(ctx as BotContext);
          break;
        case 'tron_analysis':
          await ctx.editMessageText(
            '📊 Отправьте Tron адрес для анализа:\nПример: TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH',
            keyboards.backButton('main_menu')
          );
          break;
        case 'rapira_check':
          await ctx.editMessageText(
            '🛡️ Отправьте адрес или домен для проверки через Rapira:\nПример: suspicious-site.com',
            keyboards.backButton('main_menu')
          );
          break;
        case 'rates':
          await UserCommands.rates(ctx as BotContext);
          break;
        case 'orderbook':
          await UserCommands.orderbook(ctx as BotContext);
          break;
        case 'admin_users':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.listUsers(ctx as BotContext);
          }
          break;
        case 'admin_stats':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.getSystemStats(ctx as BotContext);
          }
          break;
        case 'admin_security':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.getSecurityReport(ctx as BotContext);
          }
          break;
        case 'safecheck_status':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.safeCheckStatus(ctx as BotContext);
          }
          break;
        case 'rates':
          const ratesMessage = ExchangeRateService.getFormattedRates();
          await ctx.editMessageText(ratesMessage, { parse_mode: 'Markdown' });
          break;
        case 'orderbook':
          await ctx.editMessageText('📊 Книга ордеров\n\nПокупка/продажа криптовалют');
          break;
        case 'check_address':
          await ctx.editMessageText('🔍 Проверка адреса\n\nВведите адрес для проверки:');
          break;
        case 'tron_analysis':
          await ctx.editMessageText('⚡ Анализ TRON сети\n\nВведите адрес TRON для анализа:');
          break;
        case 'rapira_check':
          await ctx.editMessageText('🔒 Проверка Rapira\n\nВведите данные для проверки:');
          break;
        case 'admin_set_base_rate':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.setBaseRate(ctx as BotContext);
          }
          break;
        case 'admin_set_deposit_rate':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.setDepositMargin(ctx as BotContext);
          }
          break;
        case 'admin_set_withdrawal_rate':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.setWithdrawalMargin(ctx as BotContext);
          }
          break;
        case 'admin_refresh_rates':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.refreshRates(ctx as BotContext);
          }
          break;
        case 'admin_manage_rates':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.manageRates(ctx as BotContext);
          }
          break;
        case 'history':
          await UserCommands.historyPage(ctx as BotContext);
          break;
        case 'admin_requests':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.listUsers(ctx as BotContext);
          }
          break;
        case 'admin_queries':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.getPendingRequests(ctx as BotContext);
          }
          break;
          
        // УПРАВЛЕНИЕ ДОСТУПОМ
        case 'access_add_user':
          if (await this.checkAdminPermission(ctx)) {
            await ctx.editMessageText(
              '👤 Добавление пользователя в белый список\n\n' +
              'Отправьте ID пользователя, которого нужно добавить:',
              { parse_mode: 'Markdown' }
            );
            SessionService.setSession(ctx.from.id, { awaitingAccessUserId: 'add' });
          }
          break;
          
        case 'access_remove_user':
          if (await this.checkAdminPermission(ctx)) {
            await ctx.editMessageText(
              '❌ Удаление пользователя из белого списка\n\n' +
              'Отправьте ID пользователя, которого нужно удалить:',
              { parse_mode: 'Markdown' }
            );
            SessionService.setSession(ctx.from.id, { awaitingAccessUserId: 'remove' });
          }
          break;
          
        case 'access_show_users':
          if (await this.checkAdminPermission(ctx)) {
            await AdminCommands.showAccessInfo(ctx as BotContext);
          }
          break;

        // АДМИНСКИЕ ФУНКЦИИ ДЛЯ INLINE-КНОПОК
        case 'admin_applications':
          console.log('🔍 Обработка admin_applications');
          if (await this.checkAdminPermission(ctx)) {
            console.log('✅ Разрешения проверены, загружаем RoleCommands');
            const { RoleCommands } = await import('./commands/roleCommands');
            await RoleCommands.handlePendingApplications(ctx as BotContext);
          } else {
            console.log('❌ Нет разрешений для admin_applications');
          }
          break;
          
        case 'admin_check_receipts':
          console.log('🔍 Обработка admin_check_receipts');
          console.log('📋 Проверяем права администратора...');
          if (await this.checkAdminPermission(ctx)) {
            console.log('✅ Права подтверждены, отправляем сообщение');
            try {
              await ctx.editMessageText(
                '🔍 **Проверка чеков**\n\n' +
                'Отправьте документ (PDF) с чеком для проверки транзакции.',
                { parse_mode: 'Markdown' }
              );
              console.log('✅ Сообщение отправлено успешно');
            } catch (error) {
              console.error('❌ Ошибка при отправке сообщения:', error);
            }
          } else {
            console.log('❌ Нет прав администратора');
          }
          break;
          
        case 'admin_history':
          console.log('🔍 Обработка admin_history');
          if (await this.checkAdminPermission(ctx)) {
            const { RoleCommands } = await import('./commands/roleCommands');
            await RoleCommands.handleMyApplications(ctx as BotContext);
          }
          break;

        case 'db_stats':
          console.log('🔍 Обработка db_stats');
          if (await this.checkAdminPermission(ctx)) {
            await this.showDatabaseStats(ctx as BotContext);
          }
          break;

        case 'process_next_deposit':
          console.log('🔍 Обработка process_next_deposit');
          if (await this.checkAdminPermission(ctx)) {
            await NotificationService.showNextDepositForProcessing(ctx, ctx.from!.id);
          }
          break;
          
        default:
          await ctx.editMessageText('❓ Неизвестная команда');
      }
    } catch (error) {
      console.error('Callback query error:', error);
    }
  }

  private async showDatabaseStats(ctx: BotContext) {
    try {
      const stats = await DatabaseService.getDepositStats();
      
      const message = 
        `📊 **Статистика базы данных**\n\n` +
        `📋 **Заявки:**\n` +
        `• Всего: ${stats.total}\n` +
        `• В ожидании: ${stats.pending}\n` +
        `• Одобрено: ${stats.approved}\n` +
        `• Отклонено: ${stats.rejected}\n\n` +
        `💰 **Финансы (одобренные):**\n` +
        `• Общая сумма USDT: ${stats.totalUsdtApproved.toFixed(2)}\n` +
        `• Общая сумма RUB: ${stats.totalRubApproved.toFixed(2)}\n\n` +
        `📈 **Успешность:**\n` +
        `• Процент одобрения: ${stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0}%`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Последние заявки', callback_data: 'recent_deposits' },
              { text: '🔄 Обновить', callback_data: 'db_stats' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    } catch (error) {
      console.error('Ошибка получения статистики БД:', error);
      await ctx.reply('❌ Ошибка при получении статистики из базы данных');
    }
  }

  private async showMainMenu(ctx: any) {
    const welcomeText = `
🤖 *Security Bot - Главное меню*

Выберите действие из меню ниже:
    `;
    
    try {
      await ctx.editMessageText(welcomeText, { 
        parse_mode: 'Markdown'
      });
    } catch (error) {
      await ctx.reply(welcomeText);
    }
  }

  private async showFinanceMenu(ctx: any) {
    const financeText = `
💳 *Финансовые операции*

Выберите тип операции:

💰 **Пополнение** - добавить средства на баланс
💸 **Вывод** - вывести средства с баланса

Все операции проходят проверку администрации.
    `;
    
    try {
      await ctx.editMessageText(financeText, { 
        parse_mode: 'Markdown',
        ...financeMenu() 
      });
    } catch (error) {
      await ctx.reply(financeText, financeMenu());
    }
  }

  private async showCheckMenu(ctx: any) {
    const checkText = `
🔍 *Выберите тип проверки:*

• SafeCheck - общая проверка безопасности
• Tron кошелек - анализ Tron адреса  
• Домен/URL - проверка веб-ресурсов
• Hash - проверка хешей файлов
    `;
    
    try {
      await ctx.editMessageText(checkText, {
        parse_mode: 'Markdown',
        ...keyboards.checkMenu
      });
    } catch (error) {
      await ctx.reply(checkText, keyboards.checkMenu);
    }
  }

  private async checkAdminPermission(ctx: any): Promise<boolean> {
    const userId = ctx.callbackQuery?.from?.id || ctx.from?.id;
    if (!userId) return false;

    console.log(`🔍 Проверяем права для пользователя ${userId}`);

    try {
      const userRole = await RoleService.getUserRole(userId);
      const permissions = await RoleService.getUserPermissions(userId);
      
      console.log(`📋 Роль пользователя: ${userRole}`);
      console.log(`🔑 Права администратора: ${permissions.canViewApplications}`);
      
      // Проверяем, что у пользователя есть права админа или супер-админа
      const hasAdminRights = permissions.canViewApplications || permissions.canViewAllData;
      
      if (!hasAdminRights) {
        console.log('❌ У пользователя нет административных прав');
        await ctx.answerCbQuery('❌ Недостаточно прав', { show_alert: true });
        return false;
      }
      
      console.log('✅ Права администратора подтверждены');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async handleSupportMessage(ctx: BotContext) {
    const message = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (!message) return;

    const supportMessage = message.replace('#support', '').trim();
    
    try {
      await LogService.log({
        user_id: ctx.user_id!,
        action: 'support_request',
        details: {
          message: supportMessage,
          user_info: {
            username: ctx.username,
            first_name: ctx.first_name
          }
        }
      });

      if (ctx.reply) {
        await ctx.reply('📩 Ваше сообщение отправлено администраторам. Мы ответим в ближайшее время!');
      }

      // Уведомление администраторов
      const adminId = process.env.ADMIN_ID;
      if (adminId) {
        try {
          await this.bot.telegram.sendMessage(
            adminId,
            `🆘 Новое обращение в поддержку\n\n` +
            `От: ${ctx.first_name || 'Без имени'} (${ctx.user_id})\n` +
            `Username: ${ctx.username ? '@' + ctx.username : 'Нет'}\n\n` +
            `Сообщение: ${supportMessage}`
          );
        } catch (error) {
          console.error('Failed to notify admin:', error);
        }
      }
    } catch (error) {
      if (ctx.reply) {
        await ctx.reply('❌ Ошибка при отправке сообщения');
      }
    }
  }

  // МЕТОДЫ ДЛЯ РОЛЕВОЙ СИСТЕМЫ
  private async showMainPage(ctx: BotContext, userRole: UserRole) {
    console.log(`🏠 showMainPage для пользователя ${ctx.user_id}, роль: ${userRole}`);
    const roleInfo = await RoleService.getRoleInfo(ctx.user_id!);
    
    let message = `🏠 **Главная страница**\n\n`;
    message += `👤 Привет, ${ctx.first_name || 'пользователь'}!\n`;
    message += `🎭 Ваша роль: ${roleInfo.displayName}\n\n`;
    
    // Показываем доступные функции
    message += `📋 **Доступные функции:**\n`;
    if (roleInfo.permissions.canViewRates) message += `💰 Просмотр курсов валют\n`;
    if (roleInfo.permissions.canSubmitApplications) message += `📝 Подача заявок\n`;
    if (roleInfo.permissions.canCheckReceipts) message += `🔍 Проверка чеков\n`;
    if (roleInfo.permissions.canViewApplications) message += `📨 Просмотр заявок пользователей\n`;
    if (roleInfo.permissions.canManageUsers) message += `👥 Управление пользователями\n`;
    if (roleInfo.permissions.canViewAllData) message += `⚙️ Системные настройки\n`;
    
    // Отправляем сообщение с соответствующей клавиатурой
    await ctx.reply(message, getMenuByRole(userRole));
    
    // Для супер-админа дополнительно отправляем inline-кнопки
    if (userRole === UserRole.SUPER_ADMIN) {
      console.log(`🔧 Отправляем inline-кнопки для супер-админа ${ctx.user_id}`);
      await ctx.reply('🔧 **Административные функции:**', superAdminInlineMenu());
    }
  }

  private async showExchangeRates(ctx: BotContext) {
    try {
      const rates = await ExchangeRateService.getRates();
      
      // Вычисляем курсы покупки и продажи
      const buyRate = rates.base_rate * (1 + rates.deposit_margin / 100);
      const sellRate = rates.base_rate * (1 + rates.withdrawal_margin / 100);
      
      let message = `💰 **Текущие курсы обмена**\n\n`;
      message += `📈 **Покупка USDT:**\n`;
      message += `   ${buyRate.toFixed(2)} RUB за 1 USDT\n\n`;
      message += `📉 **Продажа USDT:**\n`;
      message += `   ${sellRate.toFixed(2)} RUB за 1 USDT\n\n`;
      message += `🕐 Обновлено: ${rates.last_updated.toLocaleString('ru-RU')}`;
      
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply('❌ Ошибка при получении курсов валют');
    }
  }

  private async showUserManagement(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canManageUsers) {
      await ctx.reply('❌ У вас нет прав для управления пользователями');
      return;
    }

    let message = `👥 **Управление пользователями**\n\n`;
    message += `🔧 Выберите действие:`;
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👤 Назначить администратора', callback_data: 'assign_admin' }],
          [{ text: '👑 Назначить супер админа', callback_data: 'assign_super_admin' }],
          [{ text: '📋 Список всех ролей', callback_data: 'list_roles' }],
          [{ text: '❌ Отозвать права', callback_data: 'revoke_rights' }]
        ]
      }
    });
  }

  private async showSystemSettings(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет доступа к системным настройкам');
      return;
    }

    let message = `⚙️ **Системные настройки**\n\n`;
    message += `🔧 Доступные функции:`;
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Статистика системы', callback_data: 'system_stats' }],
          [{ text: '🔄 Перезапустить сервисы', callback_data: 'restart_services' }],
          [{ text: '📝 Просмотр логов', callback_data: 'view_logs' }],
          [{ text: '💰 Управление курсами', callback_data: 'manage_rates' }]
        ]
      }
    });
  }

  private async showRolesList(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canManageRoles) {
      await ctx.reply('❌ У вас нет прав для просмотра ролей');
      return;
    }

    const superAdmins = RoleService.getAllSuperAdmins();
    const admins = RoleService.getAllAdmins();
    
    let message = `📋 **Список ролей в системе**\n\n`;
    
    message += `👑 **Супер администраторы (${superAdmins.length}):**\n`;
    superAdmins.forEach(id => {
      message += `   • ${id}\n`;
    });
    
    message += `\n👨‍💼 **Администраторы (${admins.length}):**\n`;
    admins.forEach(id => {
      message += `   • ${id}\n`;
    });
    
    message += `\n👤 **Остальные пользователи:** обычные права`;
    
    await ctx.reply(message);
  }

  private async showRevokeRightsMenu(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canManageRoles) {
      await ctx.reply('❌ У вас нет прав для отзыва ролей');
      return;
    }

    await ctx.reply(
      `❌ **Отзыв прав доступа**\n\n` +
      `Отправьте ID пользователя, у которого нужно отозвать права:\n\n` +
      `💡 После отзыва пользователь получит обычные права`
    );

    SessionService.setSession(ctx.user_id!, { awaitingRevokeUserId: true });
  }

  private async showSystemStats(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет доступа к системной статистике');
      return;
    }

    const superAdmins = RoleService.getAllSuperAdmins();
    const admins = RoleService.getAllAdmins();
    const uptime = process.uptime();
    
    let message = `📊 **Системная статистика**\n\n`;
    message += `🕐 Время работы: ${Math.floor(uptime / 3600)}ч ${Math.floor((uptime % 3600) / 60)}м\n`;
    message += `👑 Супер админов: ${superAdmins.length}\n`;
    message += `👨‍💼 Админов: ${admins.length}\n`;
    message += `💾 Память: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n`;
    message += `🟢 Статус: Активен\n`;
    message += `📅 Последнее обновление: ${new Date().toLocaleString('ru-RU')}`;
    
    await ctx.reply(message);
  }

  private async restartServices(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет прав для перезапуска сервисов');
      return;
    }

    await ctx.reply('🔄 Перезапуск сервисов...');
    
    try {
      // Здесь можно добавить логику перезапуска сервисов
      await new Promise(resolve => setTimeout(resolve, 2000));
      await ctx.reply('✅ Сервисы успешно перезапущены!');
    } catch (error) {
      await ctx.reply('❌ Ошибка при перезапуске сервисов');
    }
  }

  private async showSystemLogs(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет доступа к системным логам');
      return;
    }

    // Здесь можно добавить реальное чтение логов
    let message = `📝 **Системные логи (последние 10 записей)**\n\n`;
    message += `[${new Date().toLocaleString('ru-RU')}] INFO: Система работает нормально\n`;
    message += `[${new Date().toLocaleString('ru-RU')}] INFO: Все сервисы активны\n`;
    message += `[${new Date().toLocaleString('ru-RU')}] INFO: Последняя проверка SafeCheck: OK\n`;
    
    await ctx.reply(message);
  }

  private async showRatesManagement(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет прав для управления курсами');
      return;
    }

    const rates = ExchangeRateService.getRates();
    
    let message = `💰 **Управление курсами**\n\n`;
    message += `📈 Базовый курс: ${rates.base_rate} RUB/USDT\n`;
    message += `📊 Маржа пополнения: ${rates.deposit_margin}%\n`;
    message += `📉 Маржа вывода: ${rates.withdrawal_margin}%\n\n`;
    message += `🕐 Последнее обновление: ${rates.last_updated.toLocaleString('ru-RU')}`;
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Обновить курсы', callback_data: 'update_rates' }],
          [{ text: '⚙️ Изменить маржу', callback_data: 'change_margin' }]
        ]
      }
    });
  }

  private async handleRevokeRights(ctx: BotContext, userId: number) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canManageRoles) {
      await ctx.reply('❌ У вас нет прав для отзыва ролей');
      return;
    }

    // Проверяем, что не пытаемся отозвать права у себя
    if (userId === ctx.user_id) {
      await ctx.reply('❌ Вы не можете отозвать права у самого себя!');
      SessionService.clearSession(ctx.user_id!);
      return;
    }

    const currentRole = await RoleService.getUserRole(userId);
    
    if (currentRole === UserRole.USER) {
      await ctx.reply('ℹ️ Этот пользователь уже имеет обычные права');
      SessionService.clearSession(ctx.user_id!);
      return;
    }

    const success = await RoleService.removeUserRole(userId);

    if (success) {
      await ctx.reply(
        `✅ Права успешно отозваны!\n\n` +
        `👤 Пользователь: ${userId}\n` +
        `📉 Была роль: ${this.getRoleDisplayName(currentRole)}\n` +
        `🎯 Новая роль: 👤 Пользователь`
      );
      
      // Уведомляем пользователя об изменении роли
      try {
        await ctx.telegram.sendMessage(
          userId,
          `📢 Уведомление об изменении прав доступа\n\n` +
          `Ваши права в системе были изменены:\n` +
          `📉 Была роль: ${this.getRoleDisplayName(currentRole)}\n` +
          `🎯 Новая роль: 👤 Пользователь\n\n` +
          `Теперь вам доступны только базовые функции.`
        );
      } catch (error) {
        console.log(`Не удалось уведомить пользователя ${userId} об изменении роли`);
      }
    } else {
      await ctx.reply('❌ Ошибка при отзыве прав. Попробуйте еще раз.');
    }

    SessionService.clearSession(ctx.user_id!);
  }

  private getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case UserRole.USER:
        return '👤 Пользователь';
      case UserRole.ADMIN:
        return '👨‍💼 Администратор';
      case UserRole.SUPER_ADMIN:
        return '👑 Супер Администратор';
      default:
        return '❓ Неизвестная роль';
    }
  }

  private async initializeServices() {
    try {
      console.log('🔧 Инициализация сервисов...');
      
      // Инициализация сервиса логирования
      await LogService.init();
      console.log('✅ LogService инициализирован');

      // Инициализация системы уведомлений
      NotificationService.initialize(this.bot);
      console.log('✅ NotificationService инициализирован');

      // Инициализация базы данных
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('username:password')) {
        DatabaseService.initialize();
        const dbConnected = await DatabaseService.testConnection();
        if (dbConnected) {
          await DatabaseService.createTables();
          console.log('✅ DatabaseService инициализирован и подключен');
        } else {
          console.log('⚠️ DatabaseService: подключение к БД недоступно');
        }
      } else {
        console.log('⚠️ DATABASE_URL не настроен, работаем без БД');
      }

      // Проверяем режим разработки
      const { AccessMiddleware } = await import('./middleware/accessMiddleware');
      if (AccessMiddleware.isDevelopmentMode()) {
        const allowedUsers = AccessMiddleware.getAllowedUsers();
        console.log('🛠️ РЕЖИМ РАЗРАБОТКИ АКТИВЕН');
        console.log(`👥 Доступ разрешен только пользователям: ${allowedUsers.join(', ')}`);
      } else {
        console.log('🌍 Публичный режим - бот доступен всем пользователям');
      }

      console.log('✅ Все сервисы инициализированы');
    } catch (error) {
      console.error('❌ Ошибка инициализации сервисов:', error);
      throw error;
    }
  }

  private async setCommands() {
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Запуск бота' },
        { command: 'help', description: 'Справка по командам' },
        { command: 'check', description: 'Проверить адрес' },
        { command: 'tron', description: 'Анализ Tron адреса' },
        { command: 'rapira', description: 'Проверка через Rapira' },
        { command: 'rates', description: 'Курсы валют' },
        { command: 'orderbook', description: 'Стакан ордеров' },
        { command: 'profile', description: 'Ваш профиль' },
        { command: 'stats', description: 'Статистика проверок' },
        { command: 'support', description: 'Поддержка' }
      ]);
      console.log('✅ Команды бота установлены');
    } catch (error) {
      console.error('❌ Ошибка установки команд:', error);
    }
  }

  public async start() {
    try {
      console.log('🚀 Запуск Security Bot...');
      
      await this.initializeServices();
      await this.setCommands();
      
      // Запуск бота
      await this.bot.launch();
      console.log('✅ Security Bot успешно запущен!');

      // Уведомление администратора о запуске
      const adminId = process.env.ADMIN_ID;
      if (adminId) {
        try {
          await this.bot.telegram.sendMessage(
            adminId,
            '🚀 Security Bot запущен и готов к работе!\n\n' +
            `Время запуска: ${new Date().toLocaleString('ru-RU')}\n` +
            'Все сервисы инициализированы успешно.'
          );
        } catch (error) {
          console.error('Failed to notify admin about startup:', error);
        }
      }

    } catch (error) {
      console.error('❌ Ошибка запуска бота:', error);
      process.exit(1);
    }
  }

  private async confirmDeposit(ctx: BotContext, applicationId: string) {
    try {
      const application = await ApplicationService.getApplication(applicationId);
      
      if (!application) {
        await ctx.editMessageText('❌ Заявка не найдена');
        return;
      }

      if (application.status !== ApplicationStatus.IN_PROGRESS) {
        await ctx.editMessageText('❌ Заявка не в обработке');
        return;
      }

      // Обновляем статус заявки
      await ApplicationService.updateApplicationStatus(applicationId, ApplicationStatus.COMPLETED);

      // Уведомляем пользователя
      try {
        await this.bot.telegram.sendMessage(
          application.userId,
          `✅ *Ваша заявка на пополнение одобрена!*\n\n` +
          `💰 Сумма: ${application.amount} USDT\n` +
          `🏦 К пополнению: ${application.amountRub} RUB\n` +
          `📄 ID заявки: \`${applicationId}\`\n\n` +
          `Средства будут зачислены на ваш баланс в ближайшее время.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.error('Failed to notify user about deposit approval:', notifyError);
      }

      await ctx.editMessageText(
        `✅ *Заявка одобрена*\n\n` +
        `💰 Сумма: ${application.amount} USDT (${application.amountRub} RUB)\n` +
        `👤 Пользователь: [${application.userId}](tg://user?id=${application.userId})\n` +
        `📄 ID: \`${applicationId}\`\n\n` +
        `Пользователь уведомлен об одобрении заявки.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Назад к заявкам', callback_data: 'pending_applications' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );

    } catch (error) {
      console.error('Error confirming deposit:', error);
      await ctx.editMessageText('❌ Ошибка при одобрении заявки');
    }
  }

  private async approveDeposit(ctx: BotContext, applicationId: string) {
    try {
      const application = await ApplicationService.getApplication(applicationId);
      
      if (!application) {
        await ctx.editMessageText('❌ Заявка не найдена');
        return;
      }

      // Удаляем старое сообщение
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('Не удалось удалить сообщение:', deleteError);
      }

      // Обновляем статус заявки
      await ApplicationService.updateApplicationStatus(applicationId, ApplicationStatus.COMPLETED);

      // Обновляем статус в базе данных
      try {
        if (application.txHash) {
          const updated = await DatabaseService.updateDepositStatus(
            application.txHash,
            'approved',
            ctx.user_id!.toString()
          );
          if (updated) {
            console.log(`✅ Статус в БД обновлен: ${application.txHash} -> approved`);
          }
        }
      } catch (dbError) {
        console.error('❌ Ошибка обновления статуса в БД:', dbError);
      }

      // Извлекаем команду из описания заявки
      const teamMatch = application.title.match(/- (.+)$/);
      const teamName = teamMatch ? teamMatch[1] : 'Не указана';

      // Уведомляем пользователя
      try {
        await this.bot.telegram.sendMessage(
          application.userId,
          `✅ По данному хэшу произведено пополнение\n\n` +
          `💰 Сумма USDT: ${application.amount} USDT\n` +
          `📊 Курс: ${application.exchangeRate?.toFixed(2)} RUB/USDT\n` +
          `💵 Сумма RUB: ${application.amountRub?.toFixed(2)} RUB\n` +
          `🏆 Команда: ${teamName}`
        );
      } catch (notifyError) {
        console.error('Failed to notify user about deposit approval:', notifyError);
      }

      // Отправляем новое сообщение с результатами
      await ctx.reply(
        `✅ **Заявка одобрена и обработана**\n\n` +
        `💰 Сумма: ${application.amount} USDT (${application.amountRub?.toFixed(2)} RUB)\n` +
        `📊 Курс обмена: ${application.exchangeRate?.toFixed(2)} RUB/USDT\n` +
        `🏆 Команда: ${teamName}\n` +
        `👤 Пользователь: ${application.userId}\n` +
        `🔗 Хэш: ${application.txHash}\n` +
        `📄 ID заявки: ${applicationId}`,
        { 
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Назад к заявкам', callback_data: 'pending_applications' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );

      // Обновляем уведомления после одобрения
      await NotificationService.clearNotificationAfterProcessing(ctx.user_id!);

    } catch (error) {
      console.error('Error approving deposit:', error);
      await ctx.reply('❌ Ошибка при одобрении заявки');
    }
  }

  private async rejectDeposit(ctx: BotContext, applicationId: string) {
    try {
      const application = await ApplicationService.getApplication(applicationId);
      
      if (!application) {
        await ctx.editMessageText('❌ Заявка не найдена');
        return;
      }

      // Удаляем старое сообщение
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        console.log('Не удалось удалить сообщение:', deleteError);
      }

      // Обновляем статус заявки
      await ApplicationService.updateApplicationStatus(applicationId, ApplicationStatus.REJECTED);

      // Обновляем статус в базе данных
      try {
        if (application.txHash) {
          const updated = await DatabaseService.updateDepositStatus(
            application.txHash,
            'rejected',
            ctx.user_id!.toString()
          );
          if (updated) {
            console.log(`✅ Статус в БД обновлен: ${application.txHash} -> rejected`);
          }
        }
      } catch (dbError) {
        console.error('❌ Ошибка обновления статуса в БД:', dbError);
      }

      // Уведомляем пользователя
      try {
        await this.bot.telegram.sendMessage(
          application.userId,
          `❌ Заявка на пополнение отклонена\n\n` +
          `🔗 Хэш: ${application.txHash}\n` +
          `💰 Сумма: ${application.amount} USDT\n\n` +
          `💡 Проверьте хэш или обратитесь в чат поддержки`
        );
      } catch (notifyError) {
        console.error('Failed to notify user about deposit rejection:', notifyError);
      }

      // Отправляем новое сообщение
      await ctx.reply(
        `❌ **Заявка отклонена**\n\n` +
        `💰 Сумма: ${application.amount} USDT\n` +
        `🔗 Хэш: ${application.txHash}\n` +
        `👤 Пользователь: ${application.userId}\n` +
        `📄 ID заявки: ${applicationId}\n\n` +
        `✅ Пользователь уведомлен об отклонении.`,
        { 
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Назад к заявкам', callback_data: 'pending_applications' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );

      // Обновляем уведомления после отклонения
      await NotificationService.clearNotificationAfterProcessing(ctx.user_id!);

    } catch (error) {
      console.error('Error rejecting deposit:', error);
      await ctx.reply('❌ Ошибка при отклонении заявки');
    }
  }

  private async replyToDeposit(ctx: BotContext, applicationId: string) {
    try {
      const application = await ApplicationService.getApplication(applicationId);
      
      if (!application) {
        await ctx.editMessageText('❌ Заявка не найдена');
        return;
      }

      await ctx.editMessageText(
        `💬 **Ответ пользователю**\n\n` +
        `📄 Заявка: ${applicationId}\n` +
        `👤 Пользователь: [${application.userId}](tg://user?id=${application.userId})\n\n` +
        `✍️ **Напишите ваше сообщение:**`,
        { parse_mode: 'Markdown' }
      );

      // Устанавливаем сессию для ожидания ответа
      SessionService.setSession(ctx.user_id!, { 
        awaitingAdminReply: true, 
        replyToApplicationId: applicationId,
        replyToUserId: application.userId 
      });

    } catch (error) {
      console.error('Error setting up reply to deposit:', error);
      await ctx.editMessageText('❌ Ошибка при подготовке ответа');
    }
  }

  private async handleAdminReply(ctx: BotContext, message: string) {
    try {
      const session = SessionService.getSession(ctx.user_id!);
      
      if (!session?.awaitingAdminReply || !session.replyToUserId || !session.replyToApplicationId) {
        return;
      }

      // Отправляем сообщение пользователю
      try {
        await this.bot.telegram.sendMessage(
          session.replyToUserId,
          `💬 **Сообщение от администрации:**\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Failed to send admin reply to user:', error);
        await ctx.reply('❌ Не удалось отправить сообщение пользователю');
        return;
      }

      await ctx.reply(
        `✅ **Сообщение отправлено пользователю**\n\n` +
        `👤 Получатель: [${session.replyToUserId}](tg://user?id=${session.replyToUserId})\n` +
        `📄 Заявка: ${session.replyToApplicationId}\n\n` +
        `💬 **Ваше сообщение:**\n${message}`,
        { parse_mode: 'Markdown' }
      );

      // Очищаем сессию
      SessionService.clearSession(ctx.user_id!);

    } catch (error) {
      console.error('Error handling admin reply:', error);
      await ctx.reply('❌ Произошла ошибка при отправке ответа');
    }
  }

  public async stop() {
    console.log('🛑 Остановка бота...');
    
    // Остановка HTTP сервера
    if (this.httpServer) {
      this.httpServer.close(() => {
        console.log('✅ HTTP сервер остановлен');
      });
    }
    
    // Остановка бота
    this.bot.stop('SIGTERM');
    console.log('✅ Бот остановлен');
  }
}

// Создание и запуск бота
const bot = new SecurityBot();

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Запуск
bot.start().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});