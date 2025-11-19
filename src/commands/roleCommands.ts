import { RoleService } from '../services/roleService';
import { ApplicationService, ApplicationType, ApplicationStatus } from '../services/applicationService';
import { SessionService } from '../services/sessionService';
import { ExchangeRateService } from '../services/ExchangeRateService';
import { TronScanService } from '../services/tronScanService';
import { DatabaseService } from '../services/databaseService';
import { NotificationService } from '../services/notificationService';
import { UserRole } from '../types/UserRole';
import { getMenuByRole, userManagementMenu, applicationMenu, userApplicationMenu } from '../utils/keyboards';
import { BotContext } from '../middleware/authMiddleware';

export class RoleCommands {
  
  // КОМАНДЫ ДЛЯ ПОПОЛНЕНИЯ И ВЫВОДА
  static async handleDeposit(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canSubmitApplications) {
      await ctx.reply('❌ У вас нет прав для подачи заявок на пополнение');
      return;
    }

    const rates = ExchangeRateService.getRates();
    const depositRate = rates.base_rate * (1 + rates.deposit_margin / 100);
    
    await ctx.reply(
      `💳 Пополнение баланса\n\n` +
      `📊 Текущий курс: ${depositRate.toFixed(2)} RUB за 1 USDT\n` +
      `🏦 Официальный кошелек: ${TronScanService.getOfficialWallet()}\n\n` +
      `📝 ВАЖНО! Отправьте данные точно в 3 строки:\n\n` +
      `Строка 1: Хэш транзакции (64 символа, одной строкой!)\n` +
      `Строка 2: Сумма в USDT (только число)\n` +
      `Строка 3: Название команды\n\n` +
      `⚠️ НЕ разбивайте хэш на несколько строк!\n` +
      `💰 Отправьте данные о пополнении:`
    );

    SessionService.setSession(ctx.user_id!, { awaitingDepositData: true });
  }

  static async handleWithdraw(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canSubmitApplications) {
      await ctx.reply('❌ У вас нет прав для подачи заявок на вывод');
      return;
    }

    const rates = ExchangeRateService.getRates();
    const withdrawRate = rates.base_rate * (1 + rates.withdrawal_margin / 100);
    
    await ctx.reply(
      `💸 *Вывод средств*\n\n` +
      `📊 Текущий курс: ${withdrawRate.toFixed(2)} RUB за 1 USDT\n\n` +
      `📝 *Для вывода укажите:*\n` +
      `1. Сумму в USDT\n` +
      `2. Адрес кошелька для получения\n\n` +
      `💰 *Введите сумму в USDT:*`,
      { parse_mode: 'Markdown' }
    );

    SessionService.setSession(ctx.user_id!, { awaitingDepositData: true });
  }

  static async handleDepositData(ctx: BotContext, message: string) {
    const session = SessionService.getSession(ctx.user_id!);
    if (!session?.awaitingDepositData) return;

    // Удаляем все пробельные символы и разбиваем по строкам
    const lines = message.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Проверяем количество строк
    if (lines.length < 3) {
      await ctx.reply(
        `❌ Неверный формат данных\n\n` +
        `Получено строк: ${lines.length}, требуется: 3\n\n` +
        `Отправьте данные точно в таком формате:\n` +
        `[хэш транзакции - одной строкой]\n` +
        `[сумма в USDT]\n` +
        `[название команды]\n\n` +
        `Пример:\n` +
        `a1b2c3d4e5f6789abcdef1234567890123456789012345678901234567890\n` +
        `100\n` +
        `ZARESTON`
      );
      return;
    }

    if (lines.length > 3) {
      await ctx.reply(
        `❌ Слишком много строк данных\n\n` +
        `Получено строк: ${lines.length}, требуется: 3\n\n` +
        `Убедитесь что:\n` +
        `• Хэш транзакции написан одной строкой (без переносов)\n` +
        `• Сумма указана одним числом\n` +
        `• Название команды одной строкой\n\n` +
        `Попробуйте снова:`
      );
      return;
    }

    const [hash, amountStr, teamName] = lines;
    
    // Проверяем хэш
    if (!TronScanService.isValidTxHash(hash)) {
      await ctx.reply(
        `❌ Неверный формат хэша транзакции\n\n` +
        `Полученный хэш: ${hash}\n` +
        `Длина: ${hash.length} символов\n\n` +
        `Требования к хэшу:\n` +
        `• Должен содержать ровно 64 символа\n` +
        `• Только цифры (0-9) и буквы (a-f)\n` +
        `• Без пробелов и переносов строк\n\n` +
        `Пример правильного хэша:\n` +
        `a1b2c3d4e5f6789abcdef1234567890123456789012345678901234567890`
      );
      return;
    }

    // Проверяем сумму
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        `❌ Неверная сумма\n\n` +
        `Полученная сумма: "${amountStr}"\n\n` +
        `Введите корректную сумму в USDT:\n` +
        `• Только числа\n` +
        `• Больше 0\n` +
        `• Пример: 100 или 150.50`
      );
      return;
    }

    // Проверяем название команды
    if (!teamName || teamName.length < 2) {
      await ctx.reply(
        `❌ Название команды не может быть пустым\n\n` +
        `Укажите название вашей команды (минимум 2 символа)\n` +
        `Пример: ZARESTON`
      );
      return;
    }

    const rates = ExchangeRateService.getRates();
    const depositRate = rates.base_rate * (1 + rates.deposit_margin / 100);

    // Создаем заявку на пополнение
    const application = await ApplicationService.createApplication(
      ctx.user_id!,
      ApplicationType.DEPOSIT,
      `Пополнение ${amount} USDT - ${teamName}`,
      `Заявка на пополнение баланса команды "${teamName}"`,
      amount,
      'USDT',
      TronScanService.getOfficialWallet(),
      hash
    );

    // Сохраняем курс в заявке
    application.exchangeRate = depositRate;
    application.amountRub = (amount || 0) * depositRate;

    // Сохраняем заявку в базу данных
    try {
      const dbRecord = await DatabaseService.saveDepositApplication({
        hash: hash,
        date: new Date(),
        exchangeRate: depositRate,
        amountUsdt: amount,
        amountRub: (amount || 0) * depositRate,
        userId: ctx.user_id!.toString(),
        teamName: teamName,
        status: 'pending'
      });
      
      if (dbRecord) {
        console.log(`💾 Заявка сохранена в БД с ID: ${dbRecord}`);
      } else {
        console.log('⚠️ Не удалось сохранить заявку в БД');
      }
    } catch (dbError) {
      console.error('❌ Ошибка сохранения в БД:', dbError);
    }

    await ctx.reply(
      `✅ Заявка на пополнение создана!\n\n` +
      `📋 ID: ${application.id.split('_')[1]}\n` +
      `💰 Сумма: ${amount || 0} USDT\n` +
      `💵 К зачислению: ${((amount || 0) * depositRate).toFixed(2)} RUB\n` +
      `🏆 Команда: ${teamName}\n` +
      `🔗 Хэш: ${hash}\n` +
      `📅 Дата: ${application.createdAt.toLocaleString('ru-RU')}\n\n` +
      `⏳ Заявка отправлена на проверку администратору`
    );

    // Очищаем сессию
    SessionService.clearSession(ctx.user_id!);

    // Уведомляем супер-админов через новую систему
    console.log('Отправляем уведомление супер-админам о новой заявке через NotificationService');
    await NotificationService.notifyAboutNewDeposit();
  }

  static async handleDepositAmount(ctx: BotContext, amount: string) {
    const session = SessionService.getSession(ctx.user_id!);
    if (!session?.awaitingDepositAmount) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      await ctx.reply('❌ Неверная сумма. Введите корректную сумму в USDT:');
      return;
    }

    await ctx.reply(
      `✅ Сумма: ${amountNum} USDT\n\n` +
      `📄 **Теперь отправьте хэш транзакции**\n` +
      `Хэш должен быть 64 символа (например: a1b2c3...)\n\n` +
      `💡 Найдите хэш в вашем кошельке после отправки перевода`
    );

    SessionService.updateSession(ctx.user_id!, { 
      awaitingDepositAmount: false,
      awaitingDepositHash: true,
      depositAmount: amountNum 
    });
  }

  static async handleDepositHash(ctx: BotContext, hash: string) {
    const session = SessionService.getSession(ctx.user_id!);
    if (!session?.awaitingDepositHash) return;

    if (!TronScanService.isValidTxHash(hash)) {
      await ctx.reply('❌ Неверный формат хэша. Хэш должен содержать 64 символа (0-9, a-f). Попробуйте еще раз:');
      return;
    }

    const amount = session.depositAmount;
    const rates = ExchangeRateService.getRates();
    const depositRate = rates.base_rate * (1 + rates.deposit_margin / 100);

    // Создаем заявку на пополнение
    const application = await ApplicationService.createApplication(
      ctx.user_id!,
      ApplicationType.DEPOSIT,
      `Пополнение ${amount} USDT`,
      `Заявка на пополнение баланса`,
      amount,
      'USDT',
      TronScanService.getOfficialWallet(),
      hash
    );

    // Сохраняем курс в заявке
    application.exchangeRate = depositRate;
    application.amountRub = (amount || 0) * depositRate;

    await ctx.reply(
      `✅ Заявка на пополнение создана!\n\n` +
      `📋 ID: ${application.id.split('_')[1]}\n` +
      `💰 Сумма: ${amount || 0} USDT\n` +
      `💵 К зачислению: ${((amount || 0) * depositRate).toFixed(2)} RUB\n` +
      `🔗 Хэш: ${hash}\n` +
      `📅 Дата: ${application.createdAt.toLocaleString('ru-RU')}\n\n` +
      `⏳ Заявка отправлена на проверку администратору`
    );

    // Уведомляем супер-админов через новую систему
    console.log('Отправляем уведомление супер-админам о новой заявке через NotificationService');
    await NotificationService.notifyAboutNewDeposit();

    SessionService.clearSession(ctx.user_id!);
  }

  static async handleWithdrawAmount(ctx: BotContext, amount: string) {
    const session = SessionService.getSession(ctx.user_id!);
    if (!session?.awaitingWithdrawAmount) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      await ctx.reply('❌ Неверная сумма. Введите корректную сумму в USDT:');
      return;
    }

    await ctx.reply(
      `✅ Сумма: ${amountNum} USDT\n\n` +
      `📍 *Теперь введите адрес кошелька*\n` +
      `Адрес должен начинаться с T и содержать 34 символа\n` +
      `(например: TXZrknLXgXciqFK5seMiiTpH4DNwBydo9G)`
    );

    SessionService.updateSession(ctx.user_id!, { 
      awaitingWithdrawAmount: false,
      awaitingWithdrawWallet: true,
      withdrawAmount: amountNum 
    });
  }

  static async handleWithdrawWallet(ctx: BotContext, wallet: string) {
    const session = SessionService.getSession(ctx.user_id!);
    if (!session?.awaitingWithdrawWallet) return;

    if (!TronScanService.isValidTronAddress(wallet)) {
      await ctx.reply('❌ Неверный формат адреса. Адрес должен начинаться с T и содержать 34 символа:');
      return;
    }

    const amount = session.withdrawAmount;
    const rates = ExchangeRateService.getRates();
    const withdrawRate = rates.base_rate * (1 + rates.withdrawal_margin / 100);

    // Создаем заявку на вывод
    const application = await ApplicationService.createApplication(
      ctx.user_id!,
      ApplicationType.WITHDRAW,
      `Вывод ${amount} USDT`,
      `Заявка на вывод средств на кошелек ${wallet}`,
      amount,
      'USDT',
      wallet
    );

    // Сохраняем курс в заявке
    application.exchangeRate = withdrawRate;
    application.amountRub = (amount || 0) * withdrawRate;

    await ctx.reply(
      `✅ **Заявка на вывод создана!**\n\n` +
      `📋 ID: ${application.id.split('_')[1]}\n` +
      `💰 Сумма: ${amount || 0} USDT\n` +
      `💵 Эквивалент: ${((amount || 0) * withdrawRate).toFixed(2)} RUB\n` +
      `📍 Кошелек: \`${wallet}\`\n` +
      `📅 Дата: ${application.createdAt.toLocaleString('ru-RU')}\n\n` +
      `⏳ Заявка отправлена на рассмотрение администратору`,
      { parse_mode: 'Markdown' }
    );

    // Уведомляем админов
    this.notifyAdminsAboutNewApplication(ctx, application);

    SessionService.clearSession(ctx.user_id!);
  }

  // Обработка пополнения супер-админом
  static async processDepositApplication(ctx: BotContext, applicationId: string) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewAllData) {
      await ctx.reply('❌ У вас нет прав для обработки заявок на пополнение');
      return;
    }

    const application = await ApplicationService.getApplication(applicationId);
    if (!application || application.type !== ApplicationType.DEPOSIT) {
      await ctx.reply('❌ Заявка не найдена');
      return;
    }

    try {
      // Проверяем транзакцию через TronScan
      const result = await TronScanService.verifyTransaction(application.txHash!, application.amount || 0);
      
      if (!result.success) {
        await ctx.reply(
          `❌ *Ошибка проверки транзакции*\n\n` +
          `🔗 Хэш: ${application.txHash}\n` +
          `❗ Ошибка: ${result.error}\n\n` +
          `💡 Возможные причины:\n` +
          `• Транзакция еще не подтверждена\n` +
          `• Неверный хэш\n` +
          `• Проблемы с TronScan API`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const txData = result.data!;
      
      // Проверяем что транзакция идет на правильный кошелек
      const isCorrectWallet = TronScanService.isTransactionToOfficialWallet(txData);
      
      let verificationMessage = `🔍 *Результаты проверки транзакции*\n\n`;
      verificationMessage += `📋 Заявка #${application.id.split('_')[1]}\n`;
      verificationMessage += `👤 Пользователь: ${application.userId}\n\n`;
      
      verificationMessage += `📊 *Данные транзакции:*\n`;
      verificationMessage += `🔗 Хэш: \`${txData.hash}\`\n`;
      verificationMessage += `💰 Сумма: ${txData.amount} ${txData.token}\n`;
      verificationMessage += `📤 От: \`${txData.from}\`\n`;
      verificationMessage += `📥 К: \`${txData.to}\`\n`;
      verificationMessage += `📅 Время: ${new Date(txData.timestamp).toLocaleString('ru-RU')}\n`;
      verificationMessage += `✅ Подтверждена: ${txData.confirmed ? 'Да' : 'Нет'}\n\n`;
      
      // Проверки
      verificationMessage += `🛡️ *Проверки:*\n`;
      verificationMessage += `${isCorrectWallet ? '✅' : '❌'} Кошелек получателя: ${isCorrectWallet ? 'Правильный' : 'Неправильный'}\n`;
      verificationMessage += `${txData.token === 'USDT' ? '✅' : '❌'} Валюта: ${txData.token}\n`;
      verificationMessage += `${txData.confirmed ? '✅' : '❌'} Статус: ${txData.confirmed ? 'Подтверждена' : 'Не подтверждена'}\n\n`;
      
      if (isCorrectWallet && txData.confirmed && txData.token === 'USDT') {
        // Удаляем старое сообщение
        try {
          await ctx.deleteMessage();
        } catch (deleteError) {
          console.log('Не удалось удалить сообщение:', deleteError);
        }

        // Кошелек правильный - формируем сообщение для админа
        const exchangeRate = application.exchangeRate || 0;
        const amountUsdt = application.amount || 0;
        const amountRub = application.amountRub || (amountUsdt * exchangeRate);

        // Извлекаем команду из описания заявки
        const teamMatch = application.title.match(/- (.+)$/);
        const teamName = teamMatch ? teamMatch[1] : 'Не указана';

        await ctx.reply(
          `💰 **Заявка проверена и готова к обработке**\n\n` +
          `✅ Транзакция подтверждена через TronScan\n\n` +
          `💵 Сумма в RUB: ${amountRub.toFixed(2)} RUB\n` +
          `📊 Курс: ${exchangeRate.toFixed(2)} RUB/USDT\n` +
          `💰 Сумма в USDT: ${amountUsdt} USDT\n` +
          `🏆 Команда: ${teamName}\n` +
          `👤 Пользователь: ${application.userId}\n` +
          `🔗 Хэш: ${application.txHash}\n` +
          `📅 Дата: ${application.createdAt.toLocaleString('ru-RU')}\n\n` +
          `🛡️ Все проверки пройдены успешно`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Одобрить', callback_data: `approve_deposit_${applicationId}` },
                  { text: '❌ Отказать', callback_data: `reject_deposit_${applicationId}` }
                ],
                [
                  { text: '💬 Ответить', callback_data: `reply_deposit_${applicationId}` }
                ],
                [
                  { text: '🔙 Назад', callback_data: 'pending_applications' }
                ]
              ]
            }
          }
        );

        // Обновляем статус заявки на "в обработке"
        await ApplicationService.updateApplicationStatus(applicationId, ApplicationStatus.IN_PROGRESS);
      } else {
        await ctx.reply(
          `❌ *Транзакция некорректна*\n\n` +
          `🔗 Хэш: ${application.txHash}\n` +
          `📥 Кошелек получателя: ${txData.to}\n` +
          `🏦 Наш кошелек: ${TronScanService.getOfficialWallet()}\n\n` +
          `⚠️ Заявка не может быть обработана`,
          { parse_mode: 'Markdown' }
        );
      }
      
    } catch (error) {
      console.error('Error processing deposit:', error);
      await ctx.reply('❌ Произошла ошибка при обработке заявки');
    }
  }

  // КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ РОЛЯМИ (только супер админ)
  static async handleAssignRole(ctx: BotContext, targetRole: UserRole) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canManageRoles) {
      await ctx.reply('❌ У вас нет прав для управления ролями!');
      return;
    }

    await ctx.reply(
      `👤 Отправьте ID пользователя или перешлите его сообщение для назначения роли:\n\n` +
      `🎯 Назначаемая роль: ${this.getRoleDisplayName(targetRole)}\n\n` +
      `💡 Можете отправить:\n` +
      `• ID пользователя (например: 123456789)\n` +
      `• Переслать сообщение от пользователя`
    );

    // Сохраняем состояние ожидания ID
    SessionService.setSession(ctx.user_id!, { awaitingUserId: true, targetRole });
  }

  static async handleUserIdInput(ctx: BotContext, userId: number) {
    const session = SessionService.getSession(ctx.user_id!);
    
    if (!session?.awaitingUserId) return;

    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    if (!permissions.canManageRoles) {
      await ctx.reply('❌ У вас нет прав для управления ролями!');
      return;
    }

    // Проверяем, что не назначаем роль самому себе
    if (userId === ctx.user_id) {
      await ctx.reply('❌ Вы не можете изменить свою собственную роль!');
      SessionService.clearSession(ctx.user_id!);
      return;
    }

    const targetRole = session.targetRole;
    const currentRole = await RoleService.getUserRole(userId);
    
    // Проверяем, что роль отличается от текущей
    if (currentRole === targetRole) {
      await ctx.reply(
        `ℹ️ Пользователь уже имеет эту роль!\n\n` +
        `👤 Пользователь: ${userId}\n` +
        `🎯 Текущая роль: ${this.getRoleDisplayName(targetRole)}`
      );
      SessionService.clearSession(ctx.user_id!);
      return;
    }

    const success = await RoleService.setUserRole(userId, targetRole);

    if (success) {
      await ctx.reply(
        `✅ Роль успешно назначена!\n\n` +
        `👤 Пользователь: ${userId}\n` +
        `📈 Была роль: ${this.getRoleDisplayName(currentRole)}\n` +
        `🎯 Новая роль: ${this.getRoleDisplayName(targetRole)}`
      );
      
      // Уведомляем пользователя о назначении роли
      try {
        await ctx.telegram.sendMessage(
          userId,
          `🎉 Поздравляем! Вам назначена новая роль!\n\n` +
          `📈 Была роль: ${this.getRoleDisplayName(currentRole)}\n` +
          `🎯 Новая роль: ${this.getRoleDisplayName(targetRole)}\n\n` +
          `Теперь вам доступны дополнительные функции. Используйте кнопку "🏠 Главная страница" для обновления меню.`
        );
      } catch (error) {
        console.log(`Не удалось уведомить пользователя ${userId} о назначении роли`);
      }
    } else {
      await ctx.reply('❌ Ошибка при назначении роли. Попробуйте еще раз.');
    }

    // Очищаем состояние
    SessionService.clearSession(ctx.user_id!);
  }

  // КОМАНДЫ ДЛЯ ЗАЯВОК
  static async handleCreateApplication(ctx: BotContext) {
    await ctx.reply(
      `📝 Создание новой заявки\n\n` +
      `Выберите тип заявки:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💱 Обмен валют', callback_data: 'app_type_exchange' }],
            [{ text: '🆘 Обращение в поддержку', callback_data: 'app_type_support' }],
            [{ text: '✅ Верификация документов', callback_data: 'app_type_verification' }],
            [{ text: '📝 Другое', callback_data: 'app_type_other' }]
          ]
        }
      }
    );
  }

  static async handleApplicationType(ctx: BotContext, type: ApplicationType) {
    const typeName = ApplicationService.getApplicationTypeDisplayName(type);
    
    await ctx.reply(
      `${typeName}\n\n` +
      `📝 Опишите вашу заявку подробно:\n` +
      `• Что вам нужно?\n` +
      `• Какая сумма (если применимо)?\n` +
      `• Дополнительные детали`
    );

    SessionService.setSession(ctx.user_id!, { awaitingApplicationDetails: true, applicationType: type });
  }

  static async handleApplicationDetails(ctx: BotContext, description: string) {
    const session = SessionService.getSession(ctx.user_id!);
    
    if (!session?.awaitingApplicationDetails) return;

    const type = session.applicationType;
    const title = `${ApplicationService.getApplicationTypeDisplayName(type)} - ${new Date().toLocaleDateString()}`;
    
    const application = await ApplicationService.createApplication(
      ctx.user_id!,
      type,
      title,
      description
    );

    await ctx.reply(
      `✅ Заявка успешно создана!\n\n` +
      `📋 ID: ${application.id.split('_')[1]}\n` +
      `📝 Тип: ${ApplicationService.getApplicationTypeDisplayName(type)}\n` +
      `📅 Дата: ${application.createdAt.toLocaleString('ru-RU')}\n` +
      `📊 Статус: ${ApplicationService.getApplicationStatusDisplayName(application.status)}\n\n` +
      `💡 Администраторы рассмотрят вашу заявку в ближайшее время.`
    );

    // Уведомляем админов
    this.notifyAdminsAboutNewApplication(ctx, application);

    SessionService.clearSession(ctx.user_id!);
  }

  static async handleMyApplications(ctx: BotContext) {
    const applications = await ApplicationService.getUserApplications(ctx.user_id!);
    const userRole = await RoleService.getUserRole(ctx.user_id!);

    if (applications.length === 0) {
      let message = `📋 У вас пока нет заявок\n\n`;
      
      // Не показываем подсказку о подаче заявки для супер-админов
      if (userRole !== UserRole.SUPER_ADMIN) {
        message += `💡 Используйте кнопку "📝 Подать заявку" для создания новой заявки.`;
      }
      
      await ctx.reply(message);
      return;
    }

    let message = `📋 Ваши заявки (${applications.length}):\n\n`;

    applications.forEach((app, index) => {
      const statusIcon = ApplicationService.getApplicationStatusIcon(app.status);
      message += `${index + 1}. ${statusIcon} ${app.title}\n`;
      message += `   📅 ${app.createdAt.toLocaleDateString('ru-RU')}\n`;
      message += `   📊 ${ApplicationService.getApplicationStatusDisplayName(app.status)}\n\n`;
    });

    await ctx.reply(message);
  }

  // КОМАНДЫ ДЛЯ АДМИНИСТРАТОРОВ
  static async handlePendingApplications(ctx: BotContext) {
    const permissions = await RoleService.getUserPermissions(ctx.user_id!);
    
    if (!permissions.canViewApplications) {
      await ctx.reply('❌ У вас нет прав для просмотра заявок!');
      return;
    }

    const applications = await ApplicationService.getAllPendingApplications();

    if (applications.length === 0) {
      await ctx.reply('📋 Нет ожидающих заявок');
      return;
    }

    for (const app of applications.slice(0, 5)) { // Показываем первые 5
      const message = this.formatApplicationForAdmin(app);
      
      // Для заявок на пополнение показываем кнопку "Обработать"
      if (app.type === ApplicationType.DEPOSIT) {
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Обработать', callback_data: `process_deposit_${app.id}` }],
              [{ text: '✅ Одобрить', callback_data: `approve_${app.id}` }],
              [{ text: '❌ Отклонить', callback_data: `reject_${app.id}` }]
            ]
          }
        });
      } else {
        // Для остальных заявок стандартные кнопки
        await ctx.reply(message, applicationMenu(app.id));
      }
    }

    if (applications.length > 5) {
      await ctx.reply(`📋 Показаны первые 5 из ${applications.length} заявок`);
    }
  }

  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  private static getRoleDisplayName(role: UserRole): string {
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

  private static formatApplicationForAdmin(app: any): string {
    let message = `📋 **Заявка #${app.id.split('_')[1]}**\n\n` +
           `👤 **Пользователь:** ${app.userId}\n` +
           `📝 **Тип:** ${ApplicationService.getApplicationTypeDisplayName(app.type)}\n` +
           `📅 **Дата:** ${app.createdAt.toLocaleString('ru-RU')}\n` +
           `📊 **Статус:** ${ApplicationService.getApplicationStatusDisplayName(app.status)}\n\n`;
    
    // Для заявок на пополнение добавляем дополнительную информацию
    if (app.type === ApplicationType.DEPOSIT) {
      message += `💰 **Сумма:** ${app.amount || 0} USDT\n`;
      if (app.amountRub) {
        message += `💵 **К зачислению:** ${app.amountRub.toFixed(2)} RUB\n`;
      }
      if (app.txHash) {
        message += `🔗 **Хэш:** ${app.txHash}\n`;
      }
      message += '\n';
    }
    
    message += `📄 **Описание:**\n${app.description}`;
    
    return message;
  }

  private static async notifySuperAdminsAboutDeposit(ctx: BotContext, application: any) {
    const superAdmins = RoleService.getAllSuperAdmins();
    console.log('Список супер-админов для уведомления:', superAdmins);
    const message = `💳 НОВАЯ ЗАЯВКА НА ПОПОЛНЕНИЕ\n\n${this.formatDepositApplicationForSuperAdmin(application)}`;
    
    for (const adminId of superAdmins) {
      try {
        console.log(`Отправляем уведомление супер-админу ${adminId}`);
        await ctx.telegram.sendMessage(adminId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Обработать', callback_data: `process_deposit_${application.id}` }],
              [{ text: '✅ Одобрить', callback_data: `approve_deposit_${application.id}` }],
              [{ text: '❌ Отклонить', callback_data: `reject_deposit_${application.id}` }]
            ]
          }
        });
        console.log(`Уведомление супер-админу ${adminId} отправлено успешно`);
      } catch (error) {
        console.log(`Не удалось отправить уведомление супер-админу ${adminId}:`, error);
      }
    }
  }

  private static formatAdminDepositMessage(application: any, txData: any): string {
    const rates = ExchangeRateService.getRates();
    const depositRate = rates.base_rate * (1 + rates.deposit_margin / 100);
    
    return `💳 ПОПОЛНЕНИЕ - ГОТОВО К ЗАЧИСЛЕНИЮ\n\n` +
           `Команда: Пополнение\n` +
           `Хэш: ${txData.hash}\n` +
           `Курс: ${depositRate.toFixed(2)} RUB за 1 USDT\n` +
           `Сумма в RUB: ${(txData.amount * depositRate).toFixed(2)} ₽\n` +
           `Сумма в USDT: ${txData.amount} USDT\n\n` +
           `👤 Пользователь: ${application.userId}\n` +
           `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n` +
           `🔗 Транзакция: Подтверждена ✅`;
  }

  private static formatDepositApplicationForSuperAdmin(app: any): string {
    return `📋 Заявка #${app.id.split('_')[1]}\n\n` +
           `👤 Пользователь: ${app.userId}\n` +
           `💰 Сумма: ${app.amount} USDT\n` +
           `💵 К зачислению: ${app.amountRub?.toFixed(2)} RUB\n` +
           `📊 Курс: ${app.exchangeRate?.toFixed(2)} RUB/USDT\n` +
           `🔗 Хэш: ${app.txHash}\n` +
           `🏦 Кошелек: ${app.walletAddress}\n` +
           `📅 Дата: ${app.createdAt.toLocaleString('ru-RU')}`;
  }

  private static async notifyAdminsAboutNewApplication(ctx: BotContext, application: any) {
    const admins = RoleService.getAllStaff();
    const message = `🔔 Новая заявка!\n\n${this.formatApplicationForAdmin(application)}`;
    
    for (const adminId of admins) {
      try {
        await ctx.telegram.sendMessage(adminId, message, applicationMenu(application.id));
      } catch (error) {
        console.log(`Не удалось отправить уведомление админу ${adminId}:`, error);
      }
    }
  }
}