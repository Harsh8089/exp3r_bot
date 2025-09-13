import TelegramBot from "node-telegram-bot-api";
import { Commands, commands, labels } from "../labels";
import dbService from "../services/databaseService";
import { HandlerResponse } from "../types";

export class DebitHandler {
  public static async handleDebit(
    msg: TelegramBot.Message,
    args: string[]
  ): Promise<HandlerResponse> { 
    const [amountStr, category] = args;
    const msgInfo = commands[Commands.Debit];
    if(!amountStr || !category) {
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
      let categoryData = await dbService.createCategory(category);
      const result = await dbService.processDebit(
        userId,
        amount,
        categoryData.id
      );
      return {
        success: true,
        message: msgInfo.message(amount, result.user.walletAmount),
        data: result
      };
    } catch (error) {
      console.error('Debit handler error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process debit'
      };
    }
  } 
}

export async function processDebitTransaction(
  msg: TelegramBot.Message,
  args: string[]
): Promise<HandlerResponse> {
  return DebitHandler.handleDebit(msg, args);
}
  