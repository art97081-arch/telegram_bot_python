import { UserRole, UserPermissions, getRolePermissions, getRoleDisplayName } from '../types/UserRole';
import { UserService } from './userService';

export class RoleService {
  private static userRoles = new Map<number, UserRole>();
  
  // Список супер администраторов (ID пользователей)
  private static superAdmins = [
    6781252224, // Ваш ID
  ];
  
  // Список администраторов
  private static admins: number[] = [
    // Добавьте ID администраторов
  ];

  static async getUserRole(userId: number): Promise<UserRole> {
    // Проверяем кэш
    if (this.userRoles.has(userId)) {
      return this.userRoles.get(userId)!;
    }

    // Определяем роль
    let role: UserRole;
    
    if (this.superAdmins.includes(userId)) {
      role = UserRole.SUPER_ADMIN;
    } else if (this.admins.includes(userId)) {
      role = UserRole.ADMIN;
    } else {
      role = UserRole.USER;
    }

    // Сохраняем в кэш
    this.userRoles.set(userId, role);
    return role;
  }

  static async getUserPermissions(userId: number): Promise<UserPermissions> {
    const role = await this.getUserRole(userId);
    return getRolePermissions(role);
  }

  static async setUserRole(userId: number, role: UserRole): Promise<boolean> {
    try {
      // Обновляем роль в кэше
      this.userRoles.set(userId, role);
      
      // Обновляем списки
      this.removeFromAllLists(userId);
      
      switch (role) {
        case UserRole.SUPER_ADMIN:
          if (!this.superAdmins.includes(userId)) {
            this.superAdmins.push(userId);
          }
          break;
        case UserRole.ADMIN:
          if (!this.admins.includes(userId)) {
            this.admins.push(userId);
          }
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка при назначении роли:', error);
      return false;
    }
  }

  static async removeUserRole(userId: number): Promise<boolean> {
    try {
      this.userRoles.set(userId, UserRole.USER);
      this.removeFromAllLists(userId);
      return true;
    } catch (error) {
      console.error('Ошибка при удалении роли:', error);
      return false;
    }
  }

  private static removeFromAllLists(userId: number): void {
    const superAdminIndex = this.superAdmins.indexOf(userId);
    if (superAdminIndex > -1) {
      this.superAdmins.splice(superAdminIndex, 1);
    }
    
    const adminIndex = this.admins.indexOf(userId);
    if (adminIndex > -1) {
      this.admins.splice(adminIndex, 1);
    }
  }

  static async hasPermission(userId: number, permission: keyof UserPermissions): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions[permission];
  }

  static async getRoleInfo(userId: number): Promise<{ role: UserRole; displayName: string; permissions: UserPermissions }> {
    const role = await this.getUserRole(userId);
    const permissions = getRolePermissions(role);
    const displayName = getRoleDisplayName(role);
    
    return {
      role,
      displayName,
      permissions
    };
  }

  static getAllAdmins(): number[] {
    return [...this.admins];
  }

  static getAllSuperAdmins(): number[] {
    console.log('Получаем список всех супер-админов:', this.superAdmins);
    return [...this.superAdmins];
  }

  static async getUsersByRole(role: UserRole): Promise<number[]> {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return this.getAllSuperAdmins();
      case UserRole.ADMIN:
        return this.getAllAdmins();
      case UserRole.USER:
        // Для пользователей можно вернуть пустой массив или всех остальных
        return [];
      default:
        return [];
    }
  }

  static getAllStaff(): number[] {
    return [...this.superAdmins, ...this.admins];
  }
}