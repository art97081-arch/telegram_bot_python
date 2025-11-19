import { User, UserRole } from '../types';

export class UserModel {
  private static users: Map<number, User> = new Map();

  static async findById(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  static async create(userData: Omit<User, 'registered_at' | 'last_activity'>): Promise<User> {
    const user: User = {
      ...userData,
      registered_at: new Date(),
      last_activity: new Date()
    };
    
    this.users.set(user.id, user);
    return user;
  }

  static async update(id: number, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates, last_activity: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  static async updateLastActivity(id: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.last_activity = new Date();
      this.users.set(id, user);
    }
  }

  static async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  static async delete(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}