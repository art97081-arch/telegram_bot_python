import { SafeCheckResult } from '../types';
import axios from 'axios';

interface SafeCheckAccountInfo {
  user_id: number;
  username: string;
  status: string;
  balance: number;
  checks_balance: number;
  orig_checks_cnt: number;
  fake_checks_cnt: number;
}

interface SafeCheckCheckResult {
  color: string; // "white", "yellow", "red", "black", "not_supported"
  verifier: string;
  check_data: {
    sum?: string;
    date?: number;
    status?: string;
    sender_fio?: string;
    sender_req?: string;
    sender_bank?: string;
    recipient_fio?: string;
    recipient_req?: string;
    recipient_bank?: string;
  };
  is_original: boolean;
  device_error: boolean;
  struct_passed: boolean;
  struct_result: string;
  recommendation: string; // "Ok", "Warning", "Fake"
  file_id: string;
  status: string;
  check_timestamp: number;
}

export class SafeCheckService {
  private static cache = new Map<string, SafeCheckResult>();
  private static apiUrl = process.env.SAFECHECK_API_URL || 'https://ru.safecheck.online/api';
  private static apiKey = process.env.SAFECHECK_API_KEY;
  private static userId = process.env.SAFECHECK_USER_ID;

  private static getHeaders() {
    return {
      'SC-API-KEY': this.apiKey,
      'SC-USER-ID': this.userId,
      'Content-Type': 'application/json'
    };
  }

  // Получить информацию об аккаунте
  static async getAccountInfo(): Promise<SafeCheckAccountInfo | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/getAccountInfo`, {
        headers: this.getHeaders()
      });

      if (response.data.error === 0) {
        return response.data.result;
      } else {
        console.error('SafeCheck API error:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('SafeCheck getAccountInfo error:', error);
      return null;
    }
  }

  // Проверка адреса (для совместимости со старым API)
  static async checkAddress(address: string): Promise<SafeCheckResult> {
    // Проверяем кеш
    const cached = this.cache.get(address);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    try {
      const result = await this.performAddressCheck(address);
      this.cache.set(address, result);
      return result;
    } catch (error) {
      // Возвращаем базовый результат при ошибке API
      const fallbackResult: SafeCheckResult = {
        address,
        is_safe: false,
        risk_score: 50,
        risk_factors: ['API недоступен'],
        last_checked: new Date(),
        source: 'local_fallback'
      };
      return fallbackResult;
    }
  }

  // Проверка PDF чека
  static async checkReceipt(filePath: string): Promise<SafeCheckCheckResult | null> {
    try {
      const FormData = require('form-data');
      const fs = require('fs');
      
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${this.apiUrl}/check`, form, {
        headers: {
          ...this.getHeaders(),
          ...form.getHeaders()
        }
      });

      if (response.data.error === 0) {
        const fileId = response.data.result.file_id;
        
        // Ждем завершения проверки
        return await this.waitForCheckCompletion(fileId);
      } else {
        console.error('SafeCheck check error:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('SafeCheck checkReceipt error:', error);
      return null;
    }
  }

  // Ожидание завершения проверки
  private static async waitForCheckCompletion(fileId: string, maxRetries: number = 10): Promise<SafeCheckCheckResult | null> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${this.apiUrl}/getCheck?file_id=${fileId}`, {
          headers: this.getHeaders()
        });

        if (response.data.error === 0) {
          if (response.data.result.status === 'completed') {
            return response.data.result;
          }
          // Ждем 3 секунды перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error('SafeCheck getCheck error:', response.data.msg);
          return null;
        }
      } catch (error) {
        console.error('SafeCheck waitForCheckCompletion error:', error);
        return null;
      }
    }
    
    console.error('SafeCheck: Max retries reached waiting for check completion');
    return null;
  }

  // Получить все проверки за последние 24 часа
  static async getAllChecks(): Promise<SafeCheckCheckResult[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/getAllChecks`, {
        headers: this.getHeaders()
      });

      if (response.data.error === 0) {
        return response.data.result;
      } else {
        console.error('SafeCheck getAllChecks error:', response.data.msg);
        return [];
      }
    } catch (error) {
      console.error('SafeCheck getAllChecks error:', error);
      return [];
    }
  }

  private static async performAddressCheck(address: string): Promise<SafeCheckResult> {
    // SafeCheck API в основном для проверки банковских чеков
    // Для адресов криптовалют используем простую эвристику
    
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Проверка формата адреса
    if (address.length < 26) {
      riskFactors.push('Неверный формат адреса');
      riskScore += 30;
    }

    if (address.includes('0x') && address.length !== 42) {
      riskFactors.push('Неверная длина Ethereum адреса');
      riskScore += 20;
    }

    if (address.startsWith('T') && address.length !== 34) {
      riskFactors.push('Неверная длина Tron адреса');
      riskScore += 20;
    }

    // Проверка на известные паттерны мошенничества
    const suspiciousPatterns = ['000000', '111111', '999999'];
    if (suspiciousPatterns.some(pattern => address.includes(pattern))) {
      riskFactors.push('Подозрительный паттерн в адресе');
      riskScore += 25;
    }

    const result: SafeCheckResult = {
      address,
      is_safe: riskScore < 30,
      risk_score: Math.min(riskScore, 100),
      risk_factors: riskFactors,
      last_checked: new Date(),
      source: 'safecheck_heuristic'
    };

    return result;
  }

  private static isCacheValid(result: SafeCheckResult): boolean {
    const cacheAge = Date.now() - new Date(result.last_checked).getTime();
    const maxAge = 30 * 60 * 1000; // 30 минут
    return cacheAge < maxAge;
  }

  static async checkMultipleAddresses(addresses: string[]): Promise<SafeCheckResult[]> {
    const results = await Promise.all(
      addresses.map(address => this.checkAddress(address))
    );
    return results;
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static getCacheSize(): number {
    return this.cache.size;
  }

  // Проверка PDF чека через URL
  static async checkReceiptFromUrl(fileUrl: string): Promise<SafeCheckCheckResult | null> {
    try {
      const axios = require('axios');
      const FormData = require('form-data');
      
      // Скачиваем файл
      const fileResponse = await axios.get(fileUrl, { responseType: 'stream' });
      
      const form = new FormData();
      form.append('file', fileResponse.data);

      const response = await axios.post(`${this.apiUrl}/check`, form, {
        headers: {
          ...this.getHeaders(),
          ...form.getHeaders()
        }
      });

      console.log('SafeCheck API response:', response.data);

      if (response.data.error === 0) {
        const fileId = response.data.result.file_id;
        
        // Ждем завершения проверки
        return await this.waitForCheckCompletion(fileId);
      } else {
        console.error('SafeCheck check error:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('SafeCheck checkReceiptFromUrl error:', error);
      return null;
    }
  }
}