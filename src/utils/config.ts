export const config = {
  // Основные настройки бота
  bot: {
    token: process.env.BOT_TOKEN || '',
    adminId: process.env.ADMIN_ID || '',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    // Режим разработки - ограничивает доступ к боту
    developmentMode: process.env.DEVELOPMENT_MODE === 'true' || process.env.NODE_ENV === 'development',
    // Белый список пользователей для режима разработки
    allowedUsers: process.env.ALLOWED_USERS ? 
      process.env.ALLOWED_USERS.split(',').map(id => parseInt(id.trim())) : 
      [6781252224] // По умолчанию только супер-админ
  },

  // API настройки
  apis: {
    rapira: {
      url: process.env.RAPIRA_API_URL || 'https://api.rapira.com',
      key: process.env.RAPIRA_API_KEY || '',
      timeout: 30000,
      retries: 3
    },
    safecheck: {
      url: process.env.SAFECHECK_API_URL || 'https://api.safecheck.com',
      key: process.env.SAFECHECK_API_KEY || '',
      timeout: 30000,
      retries: 3
    },
    tron: {
      gridUrl: process.env.TRON_API_URL || 'https://api.trongrid.io',
      scanUrl: process.env.TRONSCAN_API_URL || 'https://apilist.tronscanapi.com',
      timeout: 20000,
      retries: 2
    }
  },

  // Настройки кеширования
  cache: {
    safecheck: {
      ttl: 30 * 60 * 1000, // 30 минут
      maxSize: 1000
    },
    tron: {
      ttl: 10 * 60 * 1000, // 10 минут
      maxSize: 500
    },
    rapira: {
      ttl: 60 * 60 * 1000, // 1 час
      maxSize: 500
    }
  },

  // Ограничения
  limits: {
    rateLimit: {
      requests: 20,
      window: 60000 // 1 минута
    },
    messageLength: 4000,
    broadcastBatch: 100,
    maxLogEntries: 1000,
    maxRequestHistory: 100
  },

  // Настройки безопасности
  security: {
    allowedUpdateTypes: ['message', 'callback_query'],
    maxRetries: 3,
    errorCooldown: 5000,
    suspiciousActivityThreshold: 10
  },

  // Настройки баз данных и хранения
  storage: {
    dataDir: process.env.DATA_DIR || './data',
    backupInterval: 24 * 60 * 60 * 1000, // 24 часа
    cleanupInterval: 7 * 24 * 60 * 60 * 1000, // 7 дней
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },

  // Роли и разрешения
  roles: {
    admin: {
      permissions: [
        'system_access',
        'user_management', 
        'role_management',
        'view_logs',
        'broadcast',
        'maintenance_mode'
      ]
    },
    moderator: {
      permissions: [
        'moderate_content',
        'view_reports',
        'user_management'
      ]
    },
    user: {
      permissions: [
        'basic_access',
        'check_address',
        'view_profile'
      ]
    }
  },

  // Сообщения и тексты
  messages: {
    errors: {
      generic: '❌ Произошла ошибка. Попробуйте позже.',
      permissions: '❌ У вас нет прав для выполнения этой команды',
      rateLimit: '⏳ Слишком много запросов. Попробуйте позже.',
      maintenance: '🔧 Бот находится в режиме обслуживания. Попробуйте позже.',
      invalidInput: '❌ Неверный формат данных',
      userNotFound: '❌ Пользователь не найден',
      apiUnavailable: '❌ Сервис временно недоступен'
    },
    success: {
      generic: '✅ Операция выполнена успешно',
      roleAssigned: '✅ Роль назначена',
      cacheCleared: '✅ Кеш очищен',
      maintenanceToggled: '🔧 Режим обслуживания переключен'
    }
  },

  // Настройки форматирования
  formatting: {
    dateFormat: 'ru-RU',
    timeZone: 'Europe/Moscow',
    currency: 'RUB',
    precision: 6
  }
};

// Валидация конфигурации
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.bot.token) {
    errors.push('BOT_TOKEN не установлен');
  }

  if (!config.bot.adminId) {
    errors.push('ADMIN_ID не установлен');
  }

  // Проверка API ключей (предупреждения, не критичные ошибки)
  if (!config.apis.rapira.key) {
    console.warn('RAPIRA_API_KEY не установлен - Rapira проверки будут работать в режиме заглушки');
  }

  if (!config.apis.safecheck.key) {
    console.warn('SAFECHECK_API_KEY не установлен - SafeCheck будет работать в режиме заглушки');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Получение значения конфигурации с резервным значением
export function getConfigValue(path: string, defaultValue: any = null): any {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as any)[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}