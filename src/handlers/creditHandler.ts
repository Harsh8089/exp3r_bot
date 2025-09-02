import TelegramBot from "node-telegram-bot-api";
import { Commands, commands, labels } from "../labels";
import { DatabaseService } from "../services/databaseService";
import { CacheService } from "../services/cacheService";
import { HandlerResponse } from "../types";

class CreditHandler {
  public static async handleCredit(
    msg: TelegramBot.Message,
    args: string[]
  ) {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Credit];

    if(!amountStr) {
      return {
        success: false,
        message: msgInfo.error
      }
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount < 0) {
      return {
        success: false,
        message: labels.invalidAmount
      }
    }

    const userId = BigInt(msg.chat.id);
    const cacheService = new CacheService();
    const dbService = new DatabaseService();
    try {
      const { user } = await dbService.processCredit(userId.toString(), amount);

      const userName = `${msg.chat.first_name || ''} ${msg.chat.last_name || ''}`.trim();
      cacheService.updateUser(userId.toString(), {
        id: userId,
        name: userName,
        walletAmount: user.walletAmount, 
      });

      return {
        success: true,
        message: msgInfo.message(amount, user.walletAmount),        
      };
    } catch (error) {
      console.error('Credit handler error:', error);
      return {
        success: false,
        message: 'Failed to process credit transaction'
      };
    }
  }
}

export async function processCreditTransaction(
  msg: TelegramBot.Message,
  args: string[]
): Promise<HandlerResponse> {
  return CreditHandler.handleCredit(msg, args);
}