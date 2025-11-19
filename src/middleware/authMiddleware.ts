import { UserService } from '../services/userService';
import { LogService } from '../services/logService';
import { SessionService, UserSession } from '../services/sessionService';
import { Context } from 'telegraf';

export interface BotContext extends Context {
  user_id?: number;
  username?: string;
  first_name?: string;
  session?: UserSession;
}

export const authMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
  // Получаем user_id из контекста Telegraf
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply?.('❌ Ошибка авторизации - не удалось определить пользователя');
    return;
  }

  try {
    // Добавляем данные пользователя в контекст
    ctx.user_id = userId;
    ctx.username = ctx.from?.username;
    ctx.first_name = ctx.from?.first_name;
    
    // Загружаем сессию пользователя
    ctx.session = SessionService.getSession(userId);

    // Регистрируем/обновляем пользователя
    const user = await UserService.registerUser({
      id: userId,
      username: ctx.from?.username,
      first_name: ctx.from?.first_name,
      is_bot: ctx.from?.is_bot || false
    });

    // Логируем активность
    await LogService.log({
      user_id: userId,
      action: 'message_received',
      details: {
        message: ctx.message && 'text' in ctx.message ? ctx.message.text : 'non-text message',
        chat_id: ctx.chat?.id
      }
    });

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    await ctx.reply?.('❌ Ошибка обработки запроса');
  }
};

export const requirePermission = (permission: string) => {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.user_id) {
      await ctx.reply?.('❌ Авторизация не выполнена');
      return;
    }

    try {
      // Проверяем, является ли пользователь главным администратором из .env
      const adminId = process.env.ADMIN_ID;
      if (adminId && ctx.user_id.toString() === adminId) {
        await next();
        return;
      }

      const hasPermission = await UserService.hasPermission(ctx.user_id, permission);
      
      if (!hasPermission) {
        await LogService.log({
          user_id: ctx.user_id,
          action: 'permission_denied',
          details: { required_permission: permission }
        });
        
        await ctx.reply?.('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      await next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      await ctx.reply?.('❌ Ошибка проверки прав доступа');
    }
  };
};

export const requireAdmin = requirePermission('system_access');

export const requireModerator = async (ctx: BotContext, next: () => Promise<void>) => {
  if (!ctx.user_id) {
    await ctx.reply?.('❌ Авторизация не выполнена');
    return;
  }

  try {
    // Проверяем, является ли пользователь главным администратором из .env
    const adminId = process.env.ADMIN_ID;
    if (adminId && ctx.user_id.toString() === adminId) {
      await next();
      return;
    }

    const isAdmin = await UserService.hasPermission(ctx.user_id, 'system_access');
    const isModerator = await UserService.hasPermission(ctx.user_id, 'moderate_content');
    
    if (!isAdmin && !isModerator) {
      await ctx.reply?.('❌ Требуются права модератора или администратора');
      return;
    }

    await next();
  } catch (error) {
    console.error('Moderator middleware error:', error);
    await ctx.reply?.('❌ Ошибка проверки прав доступа');
  }
};

export const rateLimitMiddleware = (maxRequests: number = 10, windowMs: number = 60000) => {
  const userRequests = new Map<number, { count: number; resetTime: number }>();

  return async (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.user_id) {
      await next();
      return;
    }

    const now = Date.now();
    const userLimit = userRequests.get(ctx.user_id);

    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(ctx.user_id, {
        count: 1,
        resetTime: now + windowMs
      });
      await next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      await ctx.reply?.('⏳ Слишком много запросов. Попробуйте позже.');
      return;
    }

    userLimit.count++;
    userRequests.set(ctx.user_id, userLimit);
    await next();
  };
};