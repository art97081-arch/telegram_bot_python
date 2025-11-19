export interface UserSession {
  awaitingUserId?: boolean;
  awaitingRevokeUserId?: boolean;
  awaitingApplicationDetails?: boolean;
  awaitingDepositAmount?: boolean;
  awaitingDepositHash?: boolean;
  awaitingDepositData?: boolean;
  awaitingWithdrawAmount?: boolean;
  awaitingWithdrawWallet?: boolean;
  awaitingAdminReply?: boolean;
  awaitingAccessUserId?: 'add' | 'remove'; // Новое поле для управления доступом
  targetRole?: any;
  applicationType?: any;
  depositAmount?: number;
  withdrawAmount?: number;
  replyToApplicationId?: string;
  replyToUserId?: number;
}

export class SessionService {
  private static sessions = new Map<number, UserSession>();

  static getSession(userId: number): UserSession {
    return this.sessions.get(userId) || {};
  }

  static setSession(userId: number, session: UserSession): void {
    this.sessions.set(userId, session);
  }

  static clearSession(userId: number): void {
    this.sessions.delete(userId);
  }

  static updateSession(userId: number, updates: Partial<UserSession>): void {
    const currentSession = this.getSession(userId);
    this.setSession(userId, { ...currentSession, ...updates });
  }
}