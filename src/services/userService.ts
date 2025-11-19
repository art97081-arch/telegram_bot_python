import { User, UserRole, Permission } from '../types';
import { UserModel } from '../models/user';

export class UserService {
  private static defaultRoles = new Map<string, UserRole>([
    ['admin', {
      id: 'admin',
      name: 'Администратор',
      permissions: [
        { id: 'user_management', name: 'Управление пользователями', description: 'Создание, редактирование и удаление пользователей' },
        { id: 'role_management', name: 'Управление ролями', description: 'Назначение и изменение ролей пользователей' },
        { id: 'system_access', name: 'Системный доступ', description: 'Полный доступ к системе' },
        { id: 'view_logs', name: 'Просмотр логов', description: 'Доступ к системным логам' }
      ],
      created_at: new Date()
    }],
    ['moderator', {
      id: 'moderator',
      name: 'Модератор',
      permissions: [
        { id: 'moderate_content', name: 'Модерация контента', description: 'Модерация пользовательского контента' },
        { id: 'view_reports', name: 'Просмотр отчетов', description: 'Доступ к отчетам и статистике' }
      ],
      created_at: new Date()
    }],
    ['user', {
      id: 'user',
      name: 'Пользователь',
      permissions: [
        { id: 'basic_access', name: 'Базовый доступ', description: 'Основные функции бота' },
        { id: 'check_address', name: 'Проверка адресов', description: 'Использование сервисов проверки' }
      ],
      created_at: new Date()
    }]
  ]);

  static async registerUser(telegramUser: any): Promise<User> {
    const existingUser = await UserModel.findById(telegramUser.id);
    
    if (existingUser) {
      await UserModel.updateLastActivity(telegramUser.id);
      return existingUser;
    }

    const user = await UserModel.create({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      is_bot: telegramUser.is_bot || false,
      language_code: telegramUser.language_code,
      role_id: 'user' // Роль по умолчанию
    });

    return user;
  }

  static async getUserById(id: number): Promise<User | null> {
    return await UserModel.findById(id);
  }

  static async updateUserRole(userId: number, roleId: string): Promise<User | null> {
    const role = this.defaultRoles.get(roleId);
    if (!role) {
      throw new Error(`Роль ${roleId} не найдена`);
    }

    return await UserModel.update(userId, { role_id: roleId });
  }

  static async getUserRole(userId: number): Promise<UserRole | null> {
    const user = await UserModel.findById(userId);
    if (!user) return null;
    
    return this.defaultRoles.get(user.role_id) || null;
  }

  static async hasPermission(userId: number, permissionId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    if (!role) return false;

    return role.permissions.some(p => p.id === permissionId);
  }

  static async isAdmin(userId: number): Promise<boolean> {
    return await this.hasPermission(userId, 'system_access');
  }

  static async getAllUsers(): Promise<User[]> {
    return await UserModel.getAllUsers();
  }

  static getAvailableRoles(): UserRole[] {
    return Array.from(this.defaultRoles.values());
  }
}