import TelegramBot from "node-telegram-bot-api";
import { Commands, commands, labels } from "../labels";
import dbService from "../services/databaseService";
import { HandlerResponse } from "../types";

class CreditHandler {
  public static async handleCredit(
    msg: TelegramBot.Message,
    args: string[]
  ): Promise<HandlerResponse> {
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

    const userId = msg.chat.id.toString();
    try {
      const result = await dbService.processCredit(
        userId, 
        amount
      );
      return {
        success: true,
        message: msgInfo.message(amount, result.user.walletAmount),        
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