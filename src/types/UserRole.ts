export enum UserRole {
  USER = 'user',           // Обычный пользователь
  ADMIN = 'admin',         // Администратор
  SUPER_ADMIN = 'super_admin' // Супер администратор
}

export interface UserPermissions {
  // Пользователь
  canViewRates: boolean;           // Смотреть курсы
  canSubmitRequests: boolean;      // Подавать заявки
  canSubmitApplications: boolean;  // Подавать запросы
  
  // Админ
  canViewApplications: boolean;    // Смотреть заявки
  canReplyToApplications: boolean; // Отвечать на заявки
  canCheckReceipts: boolean;       // Проверять чеки
  
  // Супер админ
  canManageUsers: boolean;         // Управлять пользователями
  canGrantAccess: boolean;         // Давать доступы
  canManageRoles: boolean;         // Управлять ролями
  canViewAllData: boolean;         // Доступ ко всему функционалу
}

export const getRolePermissions = (role: UserRole): UserPermissions => {
  switch (role) {
    case UserRole.USER:
      return {
        // Пользователь может только смотреть курсы и подавать заявки
        canViewRates: true,
        canSubmitRequests: true,
        canSubmitApplications: true,
        
        canViewApplications: false,
        canReplyToApplications: false,
        canCheckReceipts: false,
        
        canManageUsers: false,
        canGrantAccess: false,
        canManageRoles: false,
        canViewAllData: false
      };
      
    case UserRole.ADMIN:
      return {
        // Админ может смотреть курсы, заявки и проверять чеки
        canViewRates: true,
        canSubmitRequests: true,
        canSubmitApplications: true,
        
        canViewApplications: true,
        canReplyToApplications: true,
        canCheckReceipts: true,
        
        canManageUsers: false,
        canGrantAccess: false,
        canManageRoles: false,
        canViewAllData: false
      };
      
    case UserRole.SUPER_ADMIN:
      return {
        // Супер админ может все
        canViewRates: true,
        canSubmitRequests: true,
        canSubmitApplications: true,
        
        canViewApplications: true,
        canReplyToApplications: true,
        canCheckReceipts: true,
        
        canManageUsers: true,
        canGrantAccess: true,
        canManageRoles: true,
        canViewAllData: true
      };
      
    default:
      return getRolePermissions(UserRole.USER);
  }
};

export const getRoleDisplayName = (role: UserRole): string => {
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
};