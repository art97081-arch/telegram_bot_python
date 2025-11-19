import { ApplicationService, ApplicationType, ApplicationStatus } from './applicationService';
import { RoleService } from './roleService';
import { UserRole } from '../types/UserRole';

interface NotificationState {
  messageId?: number;
  chatId: number;
  lastUpdated: Date;
}

class NotificationService {
  private static notificationStates = new Map<number, NotificationState>();
  private static bot: any;

  static initialize(bot: any) {
    this.bot = bot;
    console.log('✅ NotificationService инициализирован');
  }

  // Обновление уведомления о заявках для супер-админа
  static async updatePendingNotification(superAdminId: number) {
    try {
      // Получаем все ожидающие заявки на пополнение
      const pendingApplications = await ApplicationService.getApplicationsByStatus(ApplicationStatus.PENDING);
      const pendingDeposits = pendingApplications.filter((app: any) => app.type === ApplicationType.DEPOSIT);

      const currentState = this.notificationStates.get(superAdminId);

      if (pendingDeposits.length === 0) {
        // Нет ожидающих заявок - удаляем уведомление если есть
        if (currentState?.messageId) {
          try {
            await this.bot.telegram.deleteMessage(superAdminId, currentState.messageId);
            console.log(`🗑️ Удалили уведомление у супер-админа ${superAdminId} (нет заявок)`);
          } catch (deleteError) {
            console.log('Не удалось удалить старое уведомление:', deleteError);
          }
          this.notificationStates.delete(superAdminId);
        }
        return;
      }

      // Формируем текст уведомления
      let message = '';
      if (pendingDeposits.length === 1) {
        message = `🔔 **Новая заявка на пополнение**\n\n⏳ Ожидает обработки: 1 заявка\n\n💡 Нажмите на кнопку ниже для просмотра`;
      } else {
        message = `🔔 **Заявки на пополнение**\n\n⏳ Ожидает обработки: ${pendingDeposits.length} заявок\n\n💡 Заявки обрабатываются по одной в порядке поступления`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📋 Обработать заявки', callback_data: 'process_next_deposit' }
          ],
          [
            { text: '📊 Все заявки', callback_data: 'admin_applications' }
          ]
        ]
      };

      if (currentState?.messageId) {
        // Обновляем существующее сообщение
        try {
          await this.bot.telegram.editMessageText(
            superAdminId,
            currentState.messageId,
            undefined,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
          console.log(`✏️ Обновили уведомление у супер-админа ${superAdminId} (${pendingDeposits.length} заявок)`);
        } catch (editError) {
          console.log('Не удалось обновить сообщение, создаем новое:', editError);
          // Если не удалось обновить, создаем новое
          await this.createNewNotification(superAdminId, message, keyboard);
        }
      } else {
        // Создаем новое сообщение
        await this.createNewNotification(superAdminId, message, keyboard);
      }

      // Обновляем состояние
      this.notificationStates.set(superAdminId, {
        messageId: currentState?.messageId,
        chatId: superAdminId,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Ошибка обновления уведомления:', error);
    }
  }

  private static async createNewNotification(superAdminId: number, message: string, keyboard: any) {
    try {
      const sentMessage = await this.bot.telegram.sendMessage(
        superAdminId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      this.notificationStates.set(superAdminId, {
        messageId: sentMessage.message_id,
        chatId: superAdminId,
        lastUpdated: new Date()
      });

      console.log(`📨 Создали новое уведомление у супер-админа ${superAdminId}`);
    } catch (sendError) {
      console.error('Ошибка создания уведомления:', sendError);
    }
  }

  // Показать следующую заявку для обработки
  static async showNextDepositForProcessing(ctx: any, superAdminId: number) {
    try {
      // Получаем самую старую ожидающую заявку на пополнение
      const pendingApplications = await ApplicationService.getApplicationsByStatus(ApplicationStatus.PENDING);
      const pendingDeposits = pendingApplications
        .filter((app: any) => app.type === ApplicationType.DEPOSIT)
        .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime()); // Сортируем по дате создания

      if (pendingDeposits.length === 0) {
        await ctx.reply('✅ Все заявки на пополнение обработаны!');
        await this.updatePendingNotification(superAdminId);
        return null;
      }

      const nextApplication = pendingDeposits[0];
      
      // Извлекаем данные из заявки
      const teamMatch = nextApplication.title.match(/- (.+)$/);
      const teamName = teamMatch ? teamMatch[1] : 'Не указана';

      const message = 
        `📋 **НОВАЯ ЗАЯВКА НА ПОПОЛНЕНИЕ**\n\n` +
        `📋 Заявка #${nextApplication.id.split('_')[1]}\n` +
        `👤 Пользователь: ${nextApplication.userId}\n` +
        `💰 Сумма: ${nextApplication.amount} USDT\n` +
        `💵 К зачислению: ${nextApplication.amountRub?.toFixed(2)} RUB\n` +
        `📊 Курс: ${nextApplication.exchangeRate?.toFixed(2)} RUB/USDT\n` +
        `🔗 Хэш: ${nextApplication.txHash}\n` +
        `🏆 Команда: ${teamName}\n` +
        `📅 Дата: ${nextApplication.createdAt.toLocaleString('ru-RU')}\n\n` +
        `⏳ Ожидает обработки: ${pendingDeposits.length} заявок`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔍 Обработать', callback_data: `process_deposit_${nextApplication.id}` }
            ],
            [
              { text: '✅ Одобрить', callback_data: `approve_deposit_${nextApplication.id}` },
              { text: '❌ Отказать', callback_data: `reject_deposit_${nextApplication.id}` }
            ],
            [
              { text: '💬 Ответить', callback_data: `reply_deposit_${nextApplication.id}` }
            ]
          ]
        }
      });

      console.log(`📋 Показали заявку ${nextApplication.id} супер-админу ${superAdminId}`);
      return nextApplication;

    } catch (error) {
      console.error('Ошибка показа следующей заявки:', error);
      await ctx.reply('❌ Ошибка при загрузке заявки');
      return null;
    }
  }

  // Уведомить всех супер-админов о новой заявке
  static async notifyAboutNewDeposit() {
    try {
      const superAdmins = await RoleService.getUsersByRole(UserRole.SUPER_ADMIN);
      
      for (const adminId of superAdmins) {
        await this.updatePendingNotification(adminId);
      }
      
      console.log(`🔔 Обновили уведомления для ${superAdmins.length} супер-админов`);
    } catch (error) {
      console.error('Ошибка уведомления супер-админов:', error);
    }
  }

  // Очистить уведомление после обработки заявки
  static async clearNotificationAfterProcessing(superAdminId: number) {
    await this.updatePendingNotification(superAdminId);
  }

  // Получить состояние уведомления
  static getNotificationState(superAdminId: number): NotificationState | undefined {
    return this.notificationStates.get(superAdminId);
  }

  // Очистить все уведомления (для отладки)
  static clearAllNotifications() {
    this.notificationStates.clear();
    console.log('🗑️ Очищены все уведомления');
  }
}

export { NotificationService };