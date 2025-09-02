import TelegramBot from "node-telegram-bot-api";
import { subDays } from "date-fns";
import { Commands, commands, labels } from "./labels";
import { PrismaClient, TransactionType } from "./generated/prisma";
import { LRUCache } from 'lru-cache';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=10&pool_timeout=20&statement_cache_size=100"
    }
  }
});

interface UserData {
  id: bigint,
  name: string,
  walletAmount: number,
  lastUpdated: number,
}

interface CategoryData {
  id: number;
  name: string;
}

const userCache = new LRUCache<string, UserData>({
  max: 100,
  ttl: 5 * 60 * 1000
});

const categoryCache = new LRUCache<string, CategoryData>({
  max: 500,       
  ttl: 30 * 60 * 1000
});

const CACHE_TTL = 5 * 60 * 1000;

class ExpenseTrackerBot {
  public bot: TelegramBot;

  constructor(token: string, options: TelegramBot.ConstructorOptions) {
    this.bot = new TelegramBot(token, options);
    this.preLoadCategories();
  }

  async preLoadCategories() {
    const categories = await prisma.category.findMany({
      take: 50
    });
    categories.forEach(cat => 
      categoryCache.set(cat.name, cat)
    );
  }

  async getCachedUser(userId: bigint, name: string) {
    const cacheKey = userId.toString();
    const cacheValue = userCache.get(cacheKey);

    if(cacheValue && (Date.now() - cacheValue.lastUpdated) <= CACHE_TTL) {
      return cacheValue;
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          id: userId
        }
      });

      if(!user) {
        await prisma.user.create({
          data: {
            id: userId,
            name,
            walletAmount: 0
          }
        });
      }

      const userData = {
        id: userId,
        name,
        walletAmount: 0,
        lastUpdated: Date.now()
      };
      userCache.set(cacheKey, userData);
    } catch (error) {
      console.error('Database error in getCachedUser:', error);
      return {
        id: userId,
        name,
        walletAmount: 0,
        lastUpdated: Date.now()
      };
    } 
  }

  updateUserCache(userId: bigint, walletAmount: number) {
    const cacheKey = userId.toString();
    const cacheValue = userCache.get(cacheKey);

    if(cacheValue) {
      cacheValue.walletAmount = walletAmount;
      cacheValue.lastUpdated = Date.now();
      userCache.set(cacheKey, cacheValue);
    }
  }

  async getCachedCategory(categoryName: string) {
    const cacheValue = categoryCache.get(categoryName);

    if(cacheValue) {
      return cacheValue;
    }

    try {
      let category = await prisma.category.findFirst({
        where: {
          name: categoryName
        }
      });

      if(!category) {
        category = await prisma.category.create({
          data: {
            name: categoryName
          }
        });
      }
      categoryCache.set(categoryName, category);
      return category;
    } catch (error) {
      console.error('Database error in getCachedCategory:', error);
      throw error;
    }
  }

  async handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    const userId = BigInt(msg.chat.id);
    const name = `${msg.chat.first_name} ${msg.chat.last_name}`.trim();

    this.getCachedUser(userId, name);

    if(!text || !text.startsWith('/')) {
      return this.sendError(msg);
    }

    const [command, ...args] = text.split(' ');
    switch(command) {
      case '/d':
        return this.handleDebit(msg, args);
      case '/c':
        return this.handleCredit(msg, args);
      case '/set':
        return this.setWallet(msg, args);
      case '/past':
        return this.getTransactionHistory(msg, args);
      case '/br':
        return this.getCategorySplit(msg, args);
      case '/undo':
        return this.handleUndo(msg);
      case'/start':
        return this.handleHelp(msg);
      case '/help':
        return this.handleHelp(msg);
      default:
        return this.sendError(msg);
    }
  }

  handleHelp(msg: TelegramBot.Message) {
    const helpText = `🤖 Expense Tracker Bot Commands\n${'='.repeat(30)}\n${Object.values(commands)
      .map(msgInfo => msgInfo.about)
      .join('\n\n')}`;

    this.bot.sendMessage(msg.chat.id, helpText);
  }

  async handleCredit(msg: TelegramBot.Message, args: string[]) {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Credit];
    if(!amountStr) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }

    const userId = msg.chat.id;
    try {
      const updatedUser = await prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          walletAmount: {
            increment: amount
          },
          transactions: {
            create: {
              amount,
              type: TransactionType.CREDIT,
              date: new Date()
            }
          }
        },
        select: {
          walletAmount: true
        }
      });
      this.updateUserCache(BigInt(userId), updatedUser.walletAmount);

      const message = msgInfo.message(amount, updatedUser.walletAmount);
      return this.bot.sendMessage(userId, message);
    } catch (error) {
      console.error('Credit operation failed:', error);
      return this.sendError(msg, 'Failed to process credit. Please try again.');
    }
  }

  async handleDebit(msg: TelegramBot.Message, args: string[]) {
    const [amountStr, category] = args;
    const msgInfo = commands[Commands.Debit];
    if(!amountStr || !category) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }

    const userId = BigInt(msg.chat.id);
    const categoryInDb = await this.getCachedCategory(category);
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          walletAmount: {
            decrement: amount
          },
          transactions: {
            create: {
              amount,
              categoryId: categoryInDb.id,
              type: TransactionType.DEBIT,
              date: new Date()
            }
          }
        },
        select: {
          walletAmount: true
        }
      });
      this.updateUserCache(BigInt(userId), updatedUser.walletAmount);

      const message = msgInfo.message(amount, updatedUser.walletAmount);
      return this.bot.sendMessage(msg.chat.id, message);
    } catch (error) {
      console.error('Debit operation failed:', error);
      return this.sendError(msg, 'Failed to process debit. Please try again.')
    }
  }

  async setWallet(msg: TelegramBot.Message, args: string[]) {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Set];
    if(!amountStr) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }

    const userId = BigInt(msg.chat.id);
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { walletAmount: amount }
      });

      this.updateUserCache(userId, amount);

      const message = msgInfo.message(amount);
      return this.bot.sendMessage(msg.chat.id, message);
    } catch (error) {
      console.error('Set wallet failed:', error);
      return this.sendError(msg, 'Failed to update wallet. Please try again.');
    }
  } 

  async getTransactionHistory(msg: TelegramBot.Message, args: string[]) {
    const [period] = args;
    const days = (period === '1d') ? 1 : (period === '1w') ? 7 : (period === '1m') ? 30 : 365
    const userId = BigInt(msg.chat.id);
    const txns = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: subDays(new Date(), days)
        }
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        id: true,
        type: true,
        amount: true,
        category: {
          select: {
            name: true
          }
        },
        date: true
      },
      take: 100
    });
    const msgInfo = commands[Commands.Past];

    if(!txns.length) {
      return this.bot.sendMessage(msg.chat.id, msgInfo.error);
    }

    const header = `Txn History (${period})\n${'='.repeat(30)}\n`;

    const message = txns
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(txn => {
        const date = txn.date.toLocaleDateString();
        const typeIcon = txn.type === TransactionType.DEBIT ? '💸' : '💰';
        const category = txn.category?.name ? ` | ${txn.category.name}` : '';
        return `${typeIcon} ${date} | ${txn.type.toUpperCase()} ₹${txn.amount}${category}`;
      })
      .join('\n');
    
    const total = txns.reduce((sum, txn) => 
      sum + (txn.type === TransactionType.DEBIT ? -txn.amount : txn.amount), 0
    );

    const footer = `\n${'='.repeat(30)}\n📈 Net: ₹${total} (${txns.length} transactions)`;
 
    return this.bot.sendMessage(msg.chat.id, header + message + footer, { parse_mode: 'HTML' });
  }
  
  async getCategorySplit(msg: TelegramBot.Message, args: string[]) {
    const [period] = args;
    const days = (period === '1d') ? 1 : (period === '1w') ? 7 : (period === '1m') ? 30 : 365

    const userId = BigInt(msg.chat.id);
    const categorySpends = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: TransactionType.DEBIT,
        date: {
          gte: subDays(new Date(), days)
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      },
    });
    const msgInfo = commands[Commands.Breakdown];

    if(!categorySpends.length) {
      return this.bot.sendMessage(msg.chat.id, msgInfo.error);
    }

    const categoryIds = categorySpends
      .filter(cs => cs.categoryId !== null)
      .map(cs => cs.categoryId!);

    const categories = await prisma.category.findMany({
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

    return this.bot.sendMessage(msg.chat.id, header + message + footer);
  }

  async handleUndo(msg: TelegramBot.Message) {
    const msgInfo = commands[Commands.Undo];
    const userId = BigInt(msg.chat.id);
    const latestTxn = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { id: true, amount: true, type: true }
    });

    if (!latestTxn) {
      return this.sendError(msg, msgInfo.error);
    }

    await prisma.$transaction(async(prisma) => {
      await prisma.transaction.delete({
        where: { id: latestTxn.id}
      });

      const increment = latestTxn.type === TransactionType.DEBIT 
        ? latestTxn.amount 
        : -latestTxn.amount;
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          walletAmount: { increment }
        }
      });

      this.updateUserCache(userId, updatedUser.walletAmount);
    });
    return this.bot.sendMessage(msg.chat.id, msgInfo.message());
  }

  sendError(msg: TelegramBot.Message, customMessage: string = 'Invalid command') {
    return this.bot.sendMessage(msg.chat.id, customMessage);
  }
}

export default ExpenseTrackerBot;
