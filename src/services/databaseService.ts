import { Pool } from 'pg';

export interface DepositRecord {
  id?: string;
  hash: string;
  date: Date;
  exchangeRate: number;
  amountUsdt: number;
  amountRub: number;
  userId: string; // кто отправил заявку
  processedBy?: string; // кто обработал (admin/super-admin)
  status: 'pending' | 'approved' | 'rejected';
  teamName?: string;
  createdAt?: Date;
  processedAt?: Date;
}

class DatabaseService {
  private static pool: Pool;

  static initialize() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    console.log('✅ DatabaseService инициализирован');
  }

  // Создание таблицы при первом запуске
  static async createTables() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          hash VARCHAR(255) UNIQUE NOT NULL,
          date TIMESTAMP NOT NULL,
          exchange_rate DECIMAL(10, 4) NOT NULL,
          amount_usdt DECIMAL(15, 6) NOT NULL,
          amount_rub DECIMAL(15, 2) NOT NULL,
          user_id VARCHAR(50) NOT NULL,
          processed_by VARCHAR(50),
          status VARCHAR(20) DEFAULT 'pending',
          team_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_deposits_hash ON deposits(hash);
        CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
        CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits(date);
      `);

      console.log('✅ Таблица deposits создана/обновлена');
    } catch (error) {
      console.error('❌ Ошибка создания таблиц:', error);
    }
  }

  // Сохранение новой заявки на пополнение
  static async saveDepositApplication(record: DepositRecord): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `INSERT INTO deposits (hash, date, exchange_rate, amount_usdt, amount_rub, user_id, team_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          record.hash,
          record.date,
          record.exchangeRate,
          record.amountUsdt,
          record.amountRub,
          record.userId,
          record.teamName,
          record.status || 'pending'
        ]
      );

      const recordId = result.rows[0].id;
      console.log(`💾 Заявка сохранена в БД с ID: ${recordId}`);
      return recordId.toString();
    } catch (error) {
      console.error('❌ Ошибка сохранения заявки:', error);
      return null;
    }
  }

  // Обновление статуса заявки при обработке
  static async updateDepositStatus(
    hash: string, 
    status: 'approved' | 'rejected', 
    processedBy: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE deposits 
         SET status = $1, processed_by = $2, processed_at = NOW()
         WHERE hash = $3`,
        [status, processedBy, hash]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`📝 Статус заявки обновлен: ${hash} -> ${status} (обработал: ${processedBy})`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Ошибка обновления статуса:', error);
      return false;
    }
  }

  // Получение записи по хэшу
  static async getDepositByHash(hash: string): Promise<DepositRecord | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM deposits WHERE hash = $1`,
        [hash]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id.toString(),
          hash: row.hash,
          date: row.date,
          exchangeRate: parseFloat(row.exchange_rate),
          amountUsdt: parseFloat(row.amount_usdt),
          amountRub: parseFloat(row.amount_rub),
          userId: row.user_id,
          processedBy: row.processed_by,
          status: row.status,
          teamName: row.team_name,
          createdAt: row.created_at,
          processedAt: row.processed_at
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Ошибка получения записи:', error);
      return null;
    }
  }

  // Получение всех заявок с фильтрами
  static async getDeposits(
    limit: number = 50,
    offset: number = 0,
    status?: string,
    userId?: string
  ): Promise<DepositRecord[]> {
    try {
      let query = `SELECT * FROM deposits WHERE 1=1`;
      const params: any[] = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      if (userId) {
        paramCount++;
        query += ` AND user_id = $${paramCount}`;
        params.push(userId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      return result.rows.map((row: any) => ({
        id: row.id.toString(),
        hash: row.hash,
        date: row.date,
        exchangeRate: parseFloat(row.exchange_rate),
        amountUsdt: parseFloat(row.amount_usdt),
        amountRub: parseFloat(row.amount_rub),
        userId: row.user_id,
        processedBy: row.processed_by,
        status: row.status,
        teamName: row.team_name,
        createdAt: row.created_at,
        processedAt: row.processed_at
      }));
    } catch (error) {
      console.error('❌ Ошибка получения списка заявок:', error);
      return [];
    }
  }

  // Получение статистики
  static async getDepositStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalUsdtApproved: number;
    totalRubApproved: number;
  }> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_usdt END), 0) as total_usdt_approved,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_rub END), 0) as total_rub_approved
        FROM deposits
      `);

      const row = result.rows[0];
      return {
        total: parseInt(row.total),
        pending: parseInt(row.pending),
        approved: parseInt(row.approved),
        rejected: parseInt(row.rejected),
        totalUsdtApproved: parseFloat(row.total_usdt_approved || 0),
        totalRubApproved: parseFloat(row.total_rub_approved || 0)
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalUsdtApproved: 0,
        totalRubApproved: 0
      };
    }
  }

  // Закрытие соединения
  static async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Соединение с БД закрыто');
    }
  }

  // Проверка подключения
  static async testConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT NOW()');
      console.log('✅ Подключение к базе данных успешно');
      return true;
    } catch (error) {
      console.error('❌ Ошибка подключения к БД:', error);
      return false;
    }
  }
}

export { DatabaseService };