export enum ApplicationType {
  DEPOSIT = 'deposit',          // Пополнение
  WITHDRAW = 'withdraw',        // Вывод
  EXCHANGE = 'exchange',        // Заявка на обмен валют
  SUPPORT = 'support',          // Обращение в поддержку
  VERIFICATION = 'verification', // Верификация документов
  OTHER = 'other'               // Другое
}

export enum ApplicationStatus {
  PENDING = 'pending',     // Ожидает рассмотрения
  APPROVED = 'approved',   // Одобрена
  REJECTED = 'rejected',   // Отклонена
  IN_PROGRESS = 'in_progress', // В работе
  COMPLETED = 'completed'  // Завершена
}

export interface Application {
  id: string;
  userId: number;
  type: ApplicationType;
  status: ApplicationStatus;
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  walletAddress?: string;        // Адрес кошелька для пополнения/вывода
  txHash?: string;              // Хэш транзакции
  exchangeRate?: number;        // Курс на момент заявки
  amountRub?: number;          // Сумма в рублях
  createdAt: Date;
  updatedAt: Date;
  adminResponse?: string;
  adminId?: number;
}

export class ApplicationService {
  private static applications = new Map<string, Application>();
  private static userApplications = new Map<number, string[]>();

  static async createApplication(
    userId: number,
    type: ApplicationType,
    title: string,
    description: string,
    amount?: number,
    currency?: string,
    walletAddress?: string,
    txHash?: string
  ): Promise<Application> {
    const id = this.generateId();
    const application: Application = {
      id,
      userId,
      type,
      status: ApplicationStatus.PENDING,
      title,
      description,
      amount,
      currency,
      walletAddress,
      txHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.applications.set(id, application);
    
    // Добавляем к пользователю
    if (!this.userApplications.has(userId)) {
      this.userApplications.set(userId, []);
    }
    this.userApplications.get(userId)!.push(id);

    return application;
  }

  static async getApplication(id: string): Promise<Application | null> {
    return this.applications.get(id) || null;
  }

  static async getUserApplications(userId: number): Promise<Application[]> {
    const userAppIds = this.userApplications.get(userId) || [];
    return userAppIds
      .map(id => this.applications.get(id))
      .filter((app): app is Application => app !== undefined);
  }

  static async getAllPendingApplications(): Promise<Application[]> {
    return Array.from(this.applications.values())
      .filter(app => app.status === ApplicationStatus.PENDING)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async getApplicationsByStatus(status: ApplicationStatus): Promise<Application[]> {
    return Array.from(this.applications.values())
      .filter(app => app.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    adminId?: number,
    adminResponse?: string
  ): Promise<boolean> {
    const application = this.applications.get(id);
    if (!application) return false;

    application.status = status;
    application.updatedAt = new Date();
    if (adminId) application.adminId = adminId;
    if (adminResponse) application.adminResponse = adminResponse;

    return true;
  }

  static async deleteApplication(id: string): Promise<boolean> {
    const application = this.applications.get(id);
    if (!application) return false;

    // Удаляем из общего списка
    this.applications.delete(id);

    // Удаляем из списка пользователя
    const userApps = this.userApplications.get(application.userId);
    if (userApps) {
      const index = userApps.indexOf(id);
      if (index > -1) {
        userApps.splice(index, 1);
      }
    }

    return true;
  }

  static getApplicationTypeDisplayName(type: ApplicationType): string {
    switch (type) {
      case ApplicationType.DEPOSIT:
        return '💳 Пополнение';
      case ApplicationType.WITHDRAW:
        return '💸 Вывод';
      case ApplicationType.EXCHANGE:
        return '💱 Обмен валют';
      case ApplicationType.SUPPORT:
        return '🆘 Поддержка';
      case ApplicationType.VERIFICATION:
        return '✅ Верификация';
      case ApplicationType.OTHER:
        return '📝 Другое';
      default:
        return '❓ Неизвестно';
    }
  }

  static getApplicationStatusDisplayName(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatus.PENDING:
        return '⏳ Ожидает';
      case ApplicationStatus.APPROVED:
        return '✅ Одобрена';
      case ApplicationStatus.REJECTED:
        return '❌ Отклонена';
      case ApplicationStatus.IN_PROGRESS:
        return '🔄 В работе';
      case ApplicationStatus.COMPLETED:
        return '✅ Завершена';
      default:
        return '❓ Неизвестно';
    }
  }

  static getApplicationStatusIcon(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatus.PENDING:
        return '⏳';
      case ApplicationStatus.APPROVED:
        return '✅';
      case ApplicationStatus.REJECTED:
        return '❌';
      case ApplicationStatus.IN_PROGRESS:
        return '🔄';
      case ApplicationStatus.COMPLETED:
        return '✅';
      default:
        return '❓';
    }
  }

  private static generateId(): string {
    return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}