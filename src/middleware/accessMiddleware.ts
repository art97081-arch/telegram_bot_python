import { config } from '../utils/config';
import { BotContext } from './authMiddleware';

export class AccessMiddleware {
  /**
   * Проверяет, разрешен ли доступ пользователю к боту
   */
  static isUserAllowed(userId: number): boolean {
    // Если режим разработки выключен, доступ разрешен всем
    if (!config.bot.developmentMode) {
      return true;
    }

    // В режиме разработки проверяем белый список
    return config.bot.allowedUsers.includes(userId);
  }

  /**
   * Middleware для проверки доступа
   */
  static async checkAccess(ctx: BotContext, next: Function): Promise<void> {
    const userId = ctx.from?.id;
    
    if (!userId) {
      console.log('❌ Получено сообщение без user ID');
      return;
    }

    if (!AccessMiddleware.isUserAllowed(userId)) {
      console.log(`🚫 Доступ запрещен для пользователя ${userId} (режим разработки)`);
      
      // Отправляем сообщение о том, что бот находится в режиме разработки
      await ctx.reply(
        '🔧 Бот находится в режиме разработки и временно недоступен.\n\n' +
        'Пожалуйста, обратитесь к администратору для получения доступа.'
      );
      return;
    }

    // Логируем разрешенный доступ
    console.log(`✅ Доступ разрешен для пользователя ${userId}`);
    
    // Продолжаем обработку
    await next();
  }

  /**
   * Получить список разрешенных пользователей
   */
  static getAllowedUsers(): number[] {
    return [...config.bot.allowedUsers];
  }

  /**
   * Добавить пользователя в белый список (только в runtime)
   */
  static addAllowedUser(userId: number): void {
    if (!config.bot.allowedUsers.includes(userId)) {
      config.bot.allowedUsers.push(userId);
      console.log(`✅ Пользователь ${userId} добавлен в белый список`);
    }
  }

  /**
   * Удалить пользователя из белого списка (только в runtime)
   */
  static removeAllowedUser(userId: number): void {
    const index = config.bot.allowedUsers.indexOf(userId);
    if (index > -1) {
      config.bot.allowedUsers.splice(index, 1);
      console.log(`❌ Пользователь ${userId} удален из белого списка`);
    }
  }

  /**
   * Получить статус режима разработки
   */
  static isDevelopmentMode(): boolean {
    return config.bot.developmentMode;
  }
}