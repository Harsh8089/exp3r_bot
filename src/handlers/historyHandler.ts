import { getDaysInMonth } from "date-fns";
import TelegramBot from "node-telegram-bot-api";
import { CategorySpend, DatabaseService } from "../services/databaseService";
import { Commands, commands } from "../labels";
import { TransactionType } from "../generated/prisma";
import { HandlerResponse } from "../types";

type Period = '1d' | '1w' | '1m' | '1yr';

class HistoryHandler {
  public static async getTransactionHistory(
    msg: TelegramBot.Message,
    args: string[],
  ): Promise<HandlerResponse> {
    const [period] = args;
    let days;
    if(this.isPeriod(period)) {
      days = this.getPastDays(period);
    } else {
      days = 365;
    }

    const userId = BigInt(msg.chat.id);
    const dbService = new DatabaseService();

    try {
      const transactions = await dbService.getTransactionHistory(
        userId.toString(),
        days
      );
      
      const msgInfo = commands[Commands.Past];
      if(!transactions.length) {
        return {
          success: false,
          message: msgInfo.error
        };
      }

      const formattedMessage = this.formatTransactionHistory(
        transactions,
        (period || '1y') as Period
      );

      return {
        success: true,
        message: formattedMessage
      };
    } catch (error) {
      console.error('History handler error:', error);
      return {
        success: false,
        message: 'Failed to fetch transaction history'
      };
    }
  }

  public static async getCategorySplit(
    msg: TelegramBot.Message,
    args: string[]
  ) {
    const [period] = args;
    let days;
    if(this.isPeriod(period)) {
      days = this.getPastDays(period);
    } else {
      days = 365;
    }

    const userId = BigInt(msg.chat.id);
    const dbService = new DatabaseService();

    try {
      const categorySpends = await dbService.getCategorySpendBreakdown(
        userId.toString(),
        days
      );
      const msgInfo = commands[Commands.Breakdown];

      if(!categorySpends.length) {
        return {
          success: false,
          message: msgInfo.error
        }
      }

      const formattedMessage = await this.formatCategorySplit(
        categorySpends,
        (days || '1yr') as Period
      );

      return {
        success: true,
        message: formattedMessage
      };
    } catch (error) {
      console.error('Category breakdown error:', error);
      return {
        success: false,
        message: 'Failed to fetch category breakdown'
      };
    }
  }

  private static getPastDays(
    period: Period = '1yr'
  ) {
    switch(period) {
      case '1d': 
        return 1;
      case '1w':
        return 7;
      case '1m':
        return getDaysInMonth(new Date());
      default:
        return 365;
    }
  } 

  // value is Period: if this function returns true, then value must be a type of Period
  private static isPeriod(value: string): value is Period {
    return ['1d', '1w', '1m', '1yr'].includes(value);
  } 

  private static formatTransactionHistory(
    transactions: any[],
    period: Period
  ) {
    const header = `Txn History (${period})\n${'='.repeat(30)}\n`;

    const message = transactions
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(txn => {
        const date = txn.date.toLocaleDateString();
        const typeIcon = txn.type === TransactionType.DEBIT ? '💸' : '💰';
        const category = txn.category?.name ? ` | ${txn.category.name}` : '';
        return `${typeIcon} ${date} | ${txn.type.toUpperCase()} ₹${txn.amount}${category}`;
      })
      .join('\n');

    const total = transactions.reduce((sum, txn) => 
      sum + (txn.type === TransactionType.DEBIT ? -txn.amount : txn.amount), 0
    );

    const footer = `\n${'='.repeat(30)}\n📈 Net: ₹${total} (${transactions.length} transactions)`;

    return header + message + footer;
  }

  private static async formatCategorySplit(
    categorySpends: CategorySpend[],
    period: Period
  ) {
    const dbService = new DatabaseService();

    const categoryIds = categorySpends
      .filter(cs => cs.categoryId !== null)
      .map(cs => cs.categoryId!);

    const categories = await dbService.getPrismaInstance().category.findMany({
      where: {
        id: {
          in: categoryIds
        }
      },
      select: {
        id: true, 
        name: true
      }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const header = `Category Breakdown (${period || '1yr'})\n${"=".repeat(30)}\n`;
    
    const message = categorySpends
      .filter(cs => cs.categoryId && cs._sum.amount)
      .sort((a, b) => (b._sum.amount || 0) - (a._sum.amount || 0))
      .map(cs => {
        const categoryName = categoryMap.get(cs.categoryId!) || 'Unknown';
        return `📊 ${categoryName} → ₹${cs._sum.amount}`;
      })
      .join("\n");

    const totalSpent = categorySpends.reduce((sum, cs) => sum + (cs._sum.amount || 0), 0);
    const totalTransactions = categorySpends.reduce((sum, cs) => sum + cs._count.id, 0);
    const footer = `\n${"=".repeat(30)}\n💸 Total Spent: ₹${totalSpent} (${totalTransactions} debit transactions)`;

    return header + message + footer;
  }
}

export async function getTransactionHistory(
  msg: TelegramBot.Message,
  args: string[]
): Promise<HandlerResponse> {
  return HistoryHandler.getTransactionHistory(msg, args);
}

export async function getCategoryBreakdown(
  msg: TelegramBot.Message,
  args: string[]
): Promise<HandlerResponse> {
  return HistoryHandler.getCategorySplit(msg, args);
}