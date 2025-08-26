import TelegramBot from "node-telegram-bot-api";

class ExpenseTrackerBot {
  public bot: TelegramBot;

  constructor(token: string, options: TelegramBot.ConstructorOptions) {
    this.bot = new TelegramBot(token, options);
  }

  handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    if(!text || !text.startsWith('/')) {
      return this.sendError(msg);
    }

    const [command, ...args] = text.split(' ');
    switch(command) {
      case '/d':
        return this.handleDebit(msg, args);
      case '/c':
        return this.handleCredit(msg, args);
      case '/help':
        return this.handleHelp(msg);
      default:
        return this.sendError(msg);
    }
  }

  handleHelp(msg: TelegramBot.Message) {
    const helpText = `
      Available commands:
      /d <amount> <description> - Record a debit
      /c <amount> - Record a credit  
      /help - Show this help message
    `;

    this.bot.sendMessage(msg.chat.id, helpText);
  }

  handleCredit(msg: TelegramBot.Message, args: string[]) {
    
  }

  handleDebit(msg: TelegramBot.Message, args: string[]) {
    
  }

  sendError(msg: TelegramBot.Message) {
    return this.bot.sendMessage(msg.chat.id, `invalid command`);
  }
}

export default ExpenseTrackerBot;
