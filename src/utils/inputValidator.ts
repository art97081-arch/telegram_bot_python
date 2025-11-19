export class InputValidator {
  static validateTronAddress(address: string): { isValid: boolean; error?: string } {
    if (!address || typeof address !== 'string') {
      return { isValid: false, error: 'Адрес не может быть пустым' };
    }

    // Убираем пробелы
    address = address.trim();

    // Tron адреса начинаются с 'T' и имеют длину 34 символа
    if (!address.startsWith('T')) {
      return { isValid: false, error: 'Tron адрес должен начинаться с буквы T' };
    }

    if (address.length !== 34) {
      return { isValid: false, error: 'Tron адрес должен содержать 34 символа' };
    }

    // Проверка на допустимые символы (Base58)
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    if (!base58Regex.test(address)) {
      return { isValid: false, error: 'Адрес содержит недопустимые символы' };
    }

    return { isValid: true };
  }

  static validateEthereumAddress(address: string): { isValid: boolean; error?: string } {
    if (!address || typeof address !== 'string') {
      return { isValid: false, error: 'Адрес не может быть пустым' };
    }

    address = address.trim();

    // Ethereum адреса начинаются с '0x' и имеют длину 42 символа
    if (!address.startsWith('0x')) {
      return { isValid: false, error: 'Ethereum адрес должен начинаться с 0x' };
    }

    if (address.length !== 42) {
      return { isValid: false, error: 'Ethereum адрес должен содержать 42 символа' };
    }

    // Проверка на hex символы
    const hexRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!hexRegex.test(address)) {
      return { isValid: false, error: 'Адрес содержит недопустимые символы' };
    }

    return { isValid: true };
  }

  static validateDomain(domain: string): { isValid: boolean; error?: string } {
    if (!domain || typeof domain !== 'string') {
      return { isValid: false, error: 'Домен не может быть пустым' };
    }

    domain = domain.trim().toLowerCase();

    // Убираем протокол если есть
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0]; // Убираем путь

    // Проверка на минимальную длину
    if (domain.length < 3) {
      return { isValid: false, error: 'Домен слишком короткий' };
    }

    // Проверка на максимальную длину
    if (domain.length > 253) {
      return { isValid: false, error: 'Домен слишком длинный' };
    }

    // Проверка формата домена
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      return { isValid: false, error: 'Неверный формат домена' };
    }

    // Проверка на наличие точки (должен быть хотя бы один поддомен)
    if (!domain.includes('.')) {
      return { isValid: false, error: 'Домен должен содержать точку' };
    }

    return { isValid: true };
  }

  static validateHash(hash: string): { isValid: boolean; error?: string } {
    if (!hash || typeof hash !== 'string') {
      return { isValid: false, error: 'Хеш не может быть пустым' };
    }

    hash = hash.trim();

    // Проверка длины для различных типов хешей
    const validLengths = [32, 40, 56, 64, 96, 128]; // MD5, SHA1, SHA224, SHA256, SHA384, SHA512
    
    if (!validLengths.includes(hash.length)) {
      return { isValid: false, error: 'Неверная длина хеша' };
    }

    // Проверка на hex символы
    const hexRegex = /^[a-fA-F0-9]+$/;
    if (!hexRegex.test(hash)) {
      return { isValid: false, error: 'Хеш должен содержать только hex символы' };
    }

    return { isValid: true };
  }

  static detectAddressType(input: string): 'tron' | 'ethereum' | 'domain' | 'hash' | 'unknown' {
    if (!input || typeof input !== 'string') {
      return 'unknown';
    }

    input = input.trim();

    // Проверка на Tron адрес
    if (input.startsWith('T') && input.length === 34) {
      return 'tron';
    }

    // Проверка на Ethereum адрес
    if (input.startsWith('0x') && input.length === 42) {
      return 'ethereum';
    }

    // Проверка на домен
    if (input.includes('.') && !input.startsWith('0x')) {
      const domainValidation = this.validateDomain(input);
      if (domainValidation.isValid) {
        return 'domain';
      }
    }

    // Проверка на хеш
    const hashValidation = this.validateHash(input);
    if (hashValidation.isValid) {
      return 'hash';
    }

    return 'unknown';
  }

  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Убираем лишние пробелы и переносы строк
    return input.trim().replace(/\s+/g, ' ');
  }

  static validateUserId(userId: any): { isValid: boolean; error?: string } {
    const id = parseInt(userId);
    
    if (isNaN(id)) {
      return { isValid: false, error: 'ID пользователя должен быть числом' };
    }

    if (id <= 0) {
      return { isValid: false, error: 'ID пользователя должен быть положительным числом' };
    }

    if (id > 999999999999) {
      return { isValid: false, error: 'Слишком большой ID пользователя' };
    }

    return { isValid: true };
  }

  static validateRole(role: string): { isValid: boolean; error?: string } {
    const validRoles = ['admin', 'moderator', 'user'];
    
    if (!role || typeof role !== 'string') {
      return { isValid: false, error: 'Роль не может быть пустой' };
    }

    const normalizedRole = role.toLowerCase().trim();
    
    if (!validRoles.includes(normalizedRole)) {
      return { 
        isValid: false, 
        error: `Неверная роль. Доступные: ${validRoles.join(', ')}` 
      };
    }

    return { isValid: true };
  }
}