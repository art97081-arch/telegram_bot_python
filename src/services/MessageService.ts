export class MessageService {
  private static messageHistory: Map<number, number[]> = new Map();
  private static readonly MAX_MESSAGES_PER_CHAT = 100;

  // Сохраняем ID сообщения для чата
  static saveMessage(chatId: number, messageId: number) {
    if (!this.messageHistory.has(chatId)) {
      this.messageHistory.set(chatId, []);
    }
    
    const messages = this.messageHistory.get(chatId)!;
    messages.push(messageId);
    
    // Ограничиваем количество сохраняемых ID
    if (messages.length > this.MAX_MESSAGES_PER_CHAT) {
      messages.shift(); // Удаляем самое старое
    }
  }

  // Получаем последние сообщения для удаления
  static getRecentMessages(chatId: number, count: number = 20): number[] {
    const messages = this.messageHistory.get(chatId) || [];
    return messages.slice(-count);
  }

  // Очищаем историю сообщений для чата
  static clearHistory(chatId: number) {
    this.messageHistory.delete(chatId);
  }

  // Удаляем указанные сообщения
  static async deleteMessages(ctx: any, chatId: number, messageIds: number[]) {
    const deletedCount = { success: 0, failed: 0 };
    
    for (const messageId of messageIds) {
      try {
        await ctx.telegram.deleteMessage(chatId, messageId);
        deletedCount.success++;
      } catch (error) {
        deletedCount.failed++;
        // Игнорируем ошибки - сообщение может быть уже удалено
      }
    }
    
    return deletedCount;
  }
}