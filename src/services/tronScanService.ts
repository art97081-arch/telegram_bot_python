import fetch from 'node-fetch';

export interface TronTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  timestamp: number;
  confirmed: boolean;
}

export interface TronScanResponse {
  success: boolean;
  data?: TronTransaction;
  error?: string;
}

export interface TransactionVerificationResult {
  success: boolean;
  data?: TronTransaction;
  error?: string;
}

export class TronScanService {
  private static readonly OFFICIAL_WALLET = 'TXZrknLXgXciqFK5seMiiTpH4DNwBydo9G';
  private static readonly TRON_API_URL = 'https://api.trongrid.io';
  
  // Проверить транзакцию по хэшу
  static async verifyTransaction(txHash: string, expectedAmount: number): Promise<TransactionVerificationResult> {
    try {
      // ВРЕМЕННАЯ ЗАГЛУШКА ДЛЯ ТЕСТИРОВАНИЯ
      // В продакшене здесь должен быть реальный API вызов
      
      // Проверяем формат хэша
      if (!this.isValidTxHash(txHash)) {
        return {
          success: false,
          error: 'Неверный формат хэша транзакции'
        };
      }
      
      // Симулируем успешную проверку
      return {
        success: true,
        data: {
          hash: txHash,
          from: 'TTestFromAddress123456789012345678',
          to: this.OFFICIAL_WALLET,
          amount: expectedAmount,
          token: 'USDT',
          timestamp: Date.now(),
          confirmed: true
        }
      };

    } catch (error) {
      console.error('TronScan API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  // Проверить что транзакция идет на правильный кошелек
  static isTransactionToOfficialWallet(transaction: TronTransaction): boolean {
    return transaction.to === this.OFFICIAL_WALLET;
  }

  // Получить информацию о кошельке
  static async getWalletInfo(address: string): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.TRON_API_URL}/account?address=${address}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SecurityBot/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('TronScan Wallet API Error:', error);
      return null;
    }
  }

  // Валидация хэша транзакции
  static isValidTxHash(hash: string): boolean {
    // TRX хэш должен быть 64 символа hex
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  // Валидация адреса кошелька
  static isValidTronAddress(address: string): boolean {
    // TRON адрес начинается с T и имеет 34 символа
    return /^T[A-Za-z1-9]{33}$/.test(address);
  }

  // Форматирование суммы
  static formatAmount(amount: number, decimals: number = 6): string {
    return (amount / Math.pow(10, decimals)).toFixed(6);
  }

  // Получить официальный кошелек
  static getOfficialWallet(): string {
    return this.OFFICIAL_WALLET;
  }
}