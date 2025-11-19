export interface ExchangeRates {
  base_rate: number;
  deposit_margin: number; // +6.3%
  withdrawal_margin: number; // +2%
  last_updated: Date;
}

export class ExchangeRateService {
  private static rates: ExchangeRates = {
    base_rate: 82.71, // Базовый курс USDT/RUB
    deposit_margin: 6.3, // Маржа для пополнения +6.3%
    withdrawal_margin: 2.0, // Маржа для вывода +2%
    last_updated: new Date()
  };

  // Получить текущие курсы
  static getRates(): ExchangeRates {
    return { ...this.rates };
  }

  // Обновить базовый курс
  static updateBaseRate(newRate: number): void {
    this.rates.base_rate = newRate;
    this.rates.last_updated = new Date();
  }

  // Обновить маржу пополнения
  static updateDepositMargin(margin: number): void {
    this.rates.deposit_margin = margin;
    this.rates.last_updated = new Date();
  }

  // Обновить маржу вывода
  static updateWithdrawalMargin(margin: number): void {
    this.rates.withdrawal_margin = margin;
    this.rates.last_updated = new Date();
  }

  // Получить курс пополнения
  static getDepositRate(): number {
    return this.rates.base_rate * (1 + this.rates.deposit_margin / 100);
  }

  // Получить курс вывода
  static getWithdrawalRate(): number {
    return this.rates.base_rate * (1 + this.rates.withdrawal_margin / 100);
  }

  // Форматированный вывод курсов
  static getFormattedRates(): string {
    const baseRate = this.rates.base_rate.toFixed(2);
    const depositRate = this.getDepositRate().toFixed(2);
    const withdrawalRate = this.getWithdrawalRate().toFixed(2);
    const lastUpdated = this.rates.last_updated.toLocaleString('ru-RU');

    return `📊 *Биржевой курс USDT/RUB*

💰 Цена: *${baseRate} ₽*

💵 *Курс пополнения*: *${depositRate} ₽* (биржевой +${this.rates.deposit_margin}%)
💸 *Курс вывода*: *${withdrawalRate} ₽* (биржевой +${this.rates.withdrawal_margin}%)

🏛️ *Биржа Rapira*
🕐 Обновлено: ${lastUpdated}`;
  }

  // Получить курсы для админки
  static getAdminRatesInfo(): string {
    return `⚙️ *Настройки курсов*

📊 Базовый курс: *${this.rates.base_rate.toFixed(2)} ₽*
📈 Маржа пополнения: *+${this.rates.deposit_margin}%*
📉 Маржа вывода: *+${this.rates.withdrawal_margin}%*

💵 Курс пополнения: *${this.getDepositRate().toFixed(2)} ₽*
💸 Курс вывода: *${this.getWithdrawalRate().toFixed(2)} ₽*

🕐 Последнее обновление: ${this.rates.last_updated.toLocaleString('ru-RU')}`;
  }
}