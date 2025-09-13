import TelegramBot from "node-telegram-bot-api";
import dbService from "../services/databaseService";
import { Commands, commands } from "../labels";
import cacheService from "../services/cacheService";
import { HandlerResponse } from "../types";

class UndoHandler {
  public static async undoLastTransaction(
    msg: TelegramBot.Message
  ): Promise<HandlerResponse> {
    const msgInfo = commands[Commands.Undo];
    const userId = msg.chat.id.toString();

    try {
      const latestTransaction = await dbService.getLatestTransaction(userId);
      if (!latestTransaction) {
        return {
          success: false,
          message: msgInfo.error
        };
      }

      const user = await dbService.undoLastTransaction(
        userId,
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