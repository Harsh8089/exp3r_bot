import TelegramBot from "node-telegram-bot-api";
import { DatabaseService } from "../services/databaseService";
import { Commands, commands } from "../labels";
import { CacheService } from "../services/cacheService";
import { HandlerResponse } from "../types";

class UndoHandler {
  public static async undoLastTransaction(
    msg: TelegramBot.Message
  ) {
    const msgInfo = commands[Commands.Undo];
    const userId = BigInt(msg.chat.id);
    
    const cacheService = new CacheService();
    const dbService = new DatabaseService();

    try {
      const latestTransaction = await dbService.getLatestTransaction(userId.toString());
      if (!latestTransaction) {
        return {
          success: false,
          message: msgInfo.error
        };
      }

      const user = await dbService.undoLastTransaction(
        userId.toString(),
        latestTransaction
      );

      cacheService.updateUser(userId.toString(), user);

      return {
        success: true,
        message: msgInfo.message(),
        data: { 
          undoneTransaction: latestTransaction,
          newBalance: user.walletAmount
        }
      };
    } catch (error) {
      console.error('Undo handler error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to undo transaction'
      };
    }
  }
}

export async function undoLastTransaction(
  msg: TelegramBot.Message
): Promise<HandlerResponse> {
  return UndoHandler.undoLastTransaction(msg);
}