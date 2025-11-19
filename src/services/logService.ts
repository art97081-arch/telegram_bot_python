import { LogEntry } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class LogService {
  private static logFile = path.join(process.cwd(), 'data', 'logs.json');
  private static logs: LogEntry[] = [];

  static async init(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.logFile));
      
      if (await fs.pathExists(this.logFile)) {
        const data = await fs.readJson(this.logFile);
        this.logs = data || [];
      }
    } catch (error) {
      console.error('Error initializing log service:', error);
      this.logs = [];
    }
  }

  static async log(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry
    };

    this.logs.push(logEntry);
    
    // Сохраняем в файл
    try {
      await fs.writeJson(this.logFile, this.logs, { spaces: 2 });
    } catch (error) {
      console.error('Error saving log:', error);
    }

    // Также выводим в консоль
    console.log(`[${logEntry.timestamp.toISOString()}] User ${logEntry.user_id}: ${logEntry.action}`, 
                logEntry.details ? JSON.stringify(logEntry.details) : '');
  }

  static async getUserLogs(userId: number, limit: number = 50): Promise<LogEntry[]> {
    return this.logs
      .filter(log => log.user_id === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  static async getAllLogs(limit: number = 100): Promise<LogEntry[]> {
    return this.logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  static async getLogsByAction(action: string, limit: number = 50): Promise<LogEntry[]> {
    return this.logs
      .filter(log => log.action === action)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  static async clearOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const initialLength = this.logs.length;
    this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoffDate);

    if (this.logs.length !== initialLength) {
      try {
        await fs.writeJson(this.logFile, this.logs, { spaces: 2 });
        console.log(`Cleaned up ${initialLength - this.logs.length} old log entries`);
      } catch (error) {
        console.error('Error cleaning up logs:', error);
      }
    }
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}