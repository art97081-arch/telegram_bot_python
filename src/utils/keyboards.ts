import { Markup } from 'telegraf';
import { UserRole } from '../types/UserRole';

// ГЛАВНОЕ МЕНЮ ДЛЯ ПОЛЬЗОВАТЕЛЯ
export const mainMenu = () => Markup.keyboard([
  ['💰 Курсы валют'],
  ['📝 Подача заявок', '📋 История заявок'],
  ['🏠 Главная страница']
]).resize();

// ГЛАВНОЕ МЕНЮ ДЛЯ АДМИНИСТРАТОРА
export const adminMainMenu = () => Markup.keyboard([
  ['💰 Курсы валют'],
  ['📝 Подача заявок', '📋 История заявок'],
  ['🔍 Проверить чек', '📨 Заявки пользователей'],
  ['🏠 Главная страница']
]).resize();

// ГЛАВНОЕ МЕНЮ ДЛЯ СУПЕР АДМИНИСТРАТОРА
export const superAdminMainMenu = () => Markup.keyboard([
  ['💰 Курсы валют', '🏠 Главная страница'],
  ['👥 Управление пользователями', '⚙️ Настройки']
]).resize();

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ МЕНЮ ПО РОЛИ
export const getMenuByRole = (role: UserRole) => {
  switch (role) {
    case UserRole.USER:
      return mainMenu();
    case UserRole.ADMIN:
      return adminMainMenu();
    case UserRole.SUPER_ADMIN:
      return superAdminMainMenu();
    default:
      return mainMenu();
  }
};

// Кнопка "Домой" для всех
export const homeMenu = () => Markup.keyboard([
  ['🏠 Главная страница']
]).resize();

// Inline меню для управления пользователями (только для супер админа)
export const userManagementMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('👤 Назначить администратора', 'assign_admin')],
  [Markup.button.callback('👑 Назначить супер админа', 'assign_super_admin')],
  [Markup.button.callback('📋 Список всех ролей', 'list_roles')],
  [Markup.button.callback('❌ Отозвать права', 'revoke_rights')]
]);

// Inline кнопки для финансовых операций
export const financeMenu = () => Markup.inlineKeyboard([
  [
    Markup.button.callback('💰 Пополнение', 'deposit'),
    Markup.button.callback('💸 Вывод', 'withdraw')
  ]
]);

// Inline меню для супер-админа с управлением заявками
export const superAdminInlineMenu = () => Markup.inlineKeyboard([
  [
    Markup.button.callback('📨 Заявки пользователей', 'admin_applications'),
    Markup.button.callback('🔍 Проверка чеков', 'admin_check_receipts')
  ],
  [
    Markup.button.callback('📋 История заявок', 'admin_history'),
    Markup.button.callback('📊 Статистика БД', 'db_stats')
  ]
]);

// Inline меню для работы с заявками (для админов)
export const applicationMenu = (applicationId: string) => Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Одобрить', `approve_${applicationId}`),
    Markup.button.callback('❌ Отклонить', `reject_${applicationId}`)
  ],
  [Markup.button.callback('💬 Ответить', `reply_${applicationId}`)]
]);

// Inline меню для заявок пользователя
export const userApplicationMenu = (applicationId: string) => Markup.inlineKeyboard([
  [Markup.button.callback('📋 Подробности', `details_${applicationId}`)],
  [Markup.button.callback('❌ Отменить заявку', `cancel_${applicationId}`)]
]);

// Старые клавиатуры для совместимости
export const keyboards = {
  // Главное меню для обычных пользователей - только 3 кнопки
  mainMenu: {
    reply_markup: {
      keyboard: [
        [
          { text: '🏠 Главная страница' },
          { text: '🔍 Проверить чек' },
          { text: '🗑️ Очистить чат' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  },

  // Главное меню для администраторов - только 3 кнопки
  adminMainMenu: {
    reply_markup: {
      keyboard: [
        [
          { text: '🏠 Главная страница' },
          { text: '🔍 Проверить чек' },
          { text: '🗑️ Очистить чат' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  },

  // Inline меню для главной страницы (обычные пользователи)
  homeMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Курс USDT/RUB', callback_data: 'rates' }
        ],
        [
          { text: '📋 История заявок', callback_data: 'history' }
        ]
      ]
    }
  },

  // Inline меню для главной страницы (администраторы)
  adminHomeMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Курс USDT/RUB', callback_data: 'rates' }
        ],
        [
          { text: '📋 История заявок', callback_data: 'history' }
        ],
        [
          { text: '📝 Заявки', callback_data: 'admin_requests' },
          { text: '📊 Запросы', callback_data: 'admin_queries' }
        ]
      ]
    }
  },

  // Inline меню для проверки
  checkMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔐 SafeCheck', callback_data: 'safecheck' },
          { text: '🔗 Tron кошелек', callback_data: 'tron_wallet' }
        ],
        [
          { text: '🌐 Домен/URL', callback_data: 'domain_check' },
          { text: '📄 Hash проверка', callback_data: 'hash_check' }
        ]
      ]
    }
  },

  // Inline админ меню
  adminMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👥 Управление пользователями', callback_data: 'admin_users' },
          { text: '📊 Системная статистика', callback_data: 'admin_stats' }
        ],
        [
          { text: '🛡️ SafeCheck статус', callback_data: 'safecheck_status' },
          { text: '� Управление курсами', callback_data: 'admin_manage_rates' }
        ],
        [
          { text: '📝 Логи системы', callback_data: 'admin_logs' },
          { text: '🔧 Настройки', callback_data: 'admin_settings' }
        ],
        [
          { text: '📢 Рассылка', callback_data: 'admin_broadcast' }
        ]
      ]
    }
  },

  // Меню профиля
  profileMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📈 Моя статистика', callback_data: 'my_stats' },
          { text: '📋 Мои запросы', callback_data: 'my_requests' }
        ]
      ]
    }
  },

  // Кнопки подтверждения
  confirmAction: (action: string) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить', callback_data: `confirm_${action}` },
          { text: '❌ Отмена', callback_data: 'cancel_action' }
        ]
      ]
    }
  }),

  // Кнопка назад
  backButton: (action: string) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔙 Назад', callback_data: action }
        ]
      ]
    }
  }),

  // Быстрые действия
  quickActions: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Проверить', callback_data: 'quick_check' },
          { text: '📊 Анализ', callback_data: 'quick_analysis' }
        ]
      ]
    }
  },

  // Убираем клавиатуру
  removeKeyboard: {
    reply_markup: {
      remove_keyboard: true
    }
  }
};