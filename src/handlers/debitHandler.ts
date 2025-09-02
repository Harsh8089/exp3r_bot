import TelegramBot from "node-telegram-bot-api";
import { Commands, commands, labels } from "../labels";
import { CacheService } from "../services/cacheService";
import { DatabaseService } from "../services/databaseService";
import { HandlerResponse } from "../types";

export class DebitHandler {
  public static async handleDebit(
    msg: TelegramBot.Message,
    args: string[]
  ) { 
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

    const userId = BigInt(msg.chat.id);
    const cacheService = new CacheService();
    const dbService = new DatabaseService();

    let categoryData  = cacheService.getCategory(category);
    try {
      if(!categoryData) {
        categoryData = await dbService.findCategory(category) ?? undefined;
        if(!categoryData) {
          categoryData = await dbService.createCategory(category);
        }
      } 
      cacheService.setCategory(categoryData.name, categoryData);

      const result = await dbService.processDebit(
        userId.toString(),
        amount,
        categoryData.id
      );

      const name = `${msg.chat.first_name || ''} ${msg.chat.last_name || ''}`.trim();
      cacheService.updateUser(userId.toString(), {
        id: userId,
        walletAmount: result.user.walletAmount,
        name,
      });

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
  