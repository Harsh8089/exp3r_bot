import TelegramBot from "node-telegram-bot-api";
import { 
  Commands, 
  commands, 
  labels 
} from "./labels";
import cacheService from "./services/cacheService";
import dbService from "./services/databaseService";
import { HandlerResponse } from "./types";
import { undoLastTransaction } from "./handlers/undoHandler";
import { processDebitTransaction } from "./handlers/debitHandler";
import { processCreditTransaction } from "./handlers/creditHandler";
import { 
  getCategoryBreakdown, 
  getTransactionHistory 
} from "./handlers/historyHandler";

export class ExpenseTrackerBot {
  public bot: TelegramBot;

  constructor(token: string, options: TelegramBot.ConstructorOptions) {
    this.bot = new TelegramBot(token, options);
  }

  async handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    const userId = BigInt(msg.chat.id);
    const name = `${msg.chat.first_name} ${msg.chat.last_name}`.trim();

    try {
      await this.ensureUserExists(userId.toString(), name);

      if(!text || !text.startsWith('/')) {
        return this.sendError(msg);
      }

      const [command, ...args] = text.split(' ');
      const result = await this.routeCommand(command, args, msg);
      if (result) {
        await this.bot.sendMessage(msg.chat.id, result.message, { 
          parse_mode: command === '/past' ? 'HTML' : undefined 
        });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      await this.sendError(msg, '⚠️ Something went wrong. Please try again.');
    } 
  }

  private async handleSetWallet(msg: TelegramBot.Message, args: string[]): Promise<HandlerResponse> {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Set];
    if (!amountStr) {
      return { 
        success: false, 
        message: msgInfo.error 
      };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) {
      return { success: false, message: labels.invalidAmount };
    }

    const userId = BigInt(msg.chat.id);
    const userName = `${msg.chat.first_name || ''} ${msg.chat.last_name || ''}`.trim();
    try {
      await dbService.updateUserWallet(
        userId.toString(), 
        amount,
        userName
      );
      return {
        success: true,
        message: `✅ Wallet set to ₹${amount}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update wallet'
      };
    }
  }

  private handleHelp() {
    const helpText = `🤖 Expense Tracker Bot Commands\n${'='.repeat(30)}\n${Object.values(commands)
      .map(msgInfo => msgInfo.about)
      .join('\n\n')}`;

    return {
      success: true,
      message: helpText
    };
  }

  private async ensureUserExists(
    userId: string,
    userName: string,
    walletAmount: number = 0
  ) {
    const cached = cacheService.getUser(userId);
    try {
      if(!cached) {
        let user = await dbService.findUser(userId);
        if(!user) {
          user = await dbService.createUser(
            userId, 
            userName, 
            walletAmount
          );
        }
        
        cacheService.setUser(userId, {
          ...user,
          id: user.id.toString(),
          lastUpdated: Date.now()
        });
      }
    } catch (error) {
      console.error('Error ensuring user exists:', error);
    }
  }

  private sendError(msg: TelegramBot.Message, customMessage: string = 'Invalid command') {
    return this.bot.sendMessage(msg.chat.id, customMessage);
  }

  private async routeCommand(
    command: string, 
    args: string[],
    msg: TelegramBot.Message,
  ): Promise<HandlerResponse> {
    switch (command) {
      case '/d':
        return await processDebitTransaction(msg, args);
      case '/c':
        return await processCreditTransaction(msg, args);
      case '/past':
        return await getTransactionHistory(msg, args);
      case '/br':
        return await getCategoryBreakdown(msg, args);
      case '/undo':
        return await undoLastTransaction(msg);
      case '/set':
        return await this.handleSetWallet(msg, args);
      case '/start':
      case '/help':
        return this.handleHelp();
      default:
        return { success: false, message: 'Invalid command' };
    }
  }
}