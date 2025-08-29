import TelegramBot from "node-telegram-bot-api";
import { subDays } from "date-fns";
import { Commands, commands, labels } from "./labels";
import { PrismaClient, TransactionType } from "./generated/prisma";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=1&pool_timeout=0"
    }
  }
});

class ExpenseTrackerBot {
  public bot: TelegramBot;

  constructor(token: string, options: TelegramBot.ConstructorOptions) {
    this.bot = new TelegramBot(token, options);
  }

  async handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    const userId = BigInt(msg.chat.id);
    const name = `${msg.chat.first_name} ${msg.chat.last_name}`;

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name,
        walletAmount: 0
      }
    });

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

    const userId = BigInt(msg.chat.id);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
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
      }
    });
    const message = msgInfo.message(amount, updatedUser.walletAmount);
    return this.bot.sendMessage(msg.chat.id, message);
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
    const categoryInDb = await prisma.category.upsert({
      where: { name: category },
      update: {},
      create: { name: category }
    });
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
      }
    })
    const message = msgInfo.message(amount, updatedUser.walletAmount);
    return this.bot.sendMessage(msg.chat.id, message);
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
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAmount: amount
      }
    });
    const message = msgInfo.message(amount);
    return this.bot.sendMessage(msg.chat.id, message);
  } 

  async getTransactionHistory(msg: TelegramBot.Message, args: string[]) {
    const [period] = args;
    const days = (period === '1d') ? 1 : (period === '1w') ? 7 : (period === '1m') ? 30 : 365
    const userId = BigInt(msg.chat.id);
    const userInDb = await prisma.user.findFirst({
      where: {
        id: userId
      },
      select: {
        transactions: {
          where: {
            date: {
              gt: subDays(new Date(), days)
            }
          },
          orderBy: {
            date: 'desc'
          },
          select: {
            id: true,
            amount: true,
            type: true,
            date: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    const txns = userInDb?.transactions ?? [];
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
    const userInDb = await prisma.user.findFirst({
      where: {
        id: userId
      },
      select: {
        transactions: {
          where: {
            date: {
              gt: subDays(new Date(), days)
            },
            type: TransactionType.DEBIT
          },
          orderBy: {
            date: 'desc'
          },
          select: {
            id: true,
            amount: true,
            type: true,
            date: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    const txns = userInDb?.transactions ?? [];
    const msgInfo = commands[Commands.Breakdown];

    if(!txns.length) {
      return this.bot.sendMessage(msg.chat.id, msgInfo.error);
    }

    const split = new Map<string, number>();
    txns.forEach(txn => {
      const amount = split.get(txn.category?.name!) || 0;
      split.set(txn.category?.name!, txn.amount + amount);
    });

    const header = `Category Breakdown (${period || '1yr'})\n${"=".repeat(30)}\n`;

    const message = Array.from(split.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => {
        return `📊 ${category} → ₹${amount}`;
      })
      .join("\n");

    const totalSpent = txns.reduce((sum, txn) => sum + txn.amount, 0);
    const footer = `\n${"=".repeat(30)}\n💸 Total Spent: ₹${totalSpent} (${txns.length} debit transactions)`;

    return this.bot.sendMessage(msg.chat.id, header + message + footer, {
      parse_mode: "HTML",
    });
  }

  async handleUndo(msg: TelegramBot.Message) {
    const msgInfo = commands[Commands.Undo];
    const userId = BigInt(msg.chat.id);
    const userInDb = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        transactions: true
      }
    });
    const txns = userInDb?.transactions ?? [];
    if(!txns.length) {
      return this.sendError(msg, msgInfo.error);
    }

    const latestTxn = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    await prisma.transaction.delete({
      where: { id: latestTxn?.id },
    })
    return this.bot.sendMessage(msg.chat.id, msgInfo.message());
  }

  sendError(msg: TelegramBot.Message, customMessage: string = 'Invalid command') {
    return this.bot.sendMessage(msg.chat.id, customMessage);
  }
}

export default ExpenseTrackerBot;
