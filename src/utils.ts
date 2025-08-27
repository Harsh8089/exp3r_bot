import TelegramBot from "node-telegram-bot-api";
import { subDays } from "date-fns";
import { Commands, commands, labels } from "./labels";

interface Transaction {
  id: number,
  type: 'credit' | 'debit',
  amount: number,
  category?: string
  date: Date
}

class ExpenseTrackerBot {
  public bot: TelegramBot;
  public wallet: number;
  public transactions: Transaction[];

  constructor(token: string, options: TelegramBot.ConstructorOptions) {
    this.bot = new TelegramBot(token, options);
    this.wallet = 0;
    this.transactions = [];
  }

  handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
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

  handleCredit(msg: TelegramBot.Message, args: string[]) {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Credit];
    if(!amountStr) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }

    this.wallet += amount;
    this.transactions.push({
      id: this.transactions.length,
      type: 'credit',
      amount,
      date: new Date()
    });

    const message = msgInfo.message(amount, this.wallet);
    return this.bot.sendMessage(msg.chat.id, message);
  }

  handleDebit(msg: TelegramBot.Message, args: string[]) {
    const [amountStr, category] = args;
    const msgInfo = commands[Commands.Debit];
    if(!amountStr || !category) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }

    this.wallet -= amount;
    this.transactions.push({
      id: this.transactions.length,
      type: 'debit',
      amount,
      category,
      date: new Date()
    });
    const message = msgInfo.message(amount, this.wallet);
    return this.bot.sendMessage(msg.chat.id, message);
  }

  setWallet(msg: TelegramBot.Message, args: string[]) {
    const [amountStr] = args;
    const msgInfo = commands[Commands.Set];
    if(!amountStr) {
      return this.sendError(msg, msgInfo.error);
    }

    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) {
      return this.sendError(msg, labels.invalidAmount);
    }
    const message = msgInfo.message(this.wallet);
    return this.bot.sendMessage(msg.chat.id, message);
  } 

  getTransactionHistory(msg: TelegramBot.Message, args: string[]) {
    const [period] = args;
    const days = (period === '1d') ? 1 : (period === '1w') ? 7 : (period === '1m') ? 30 : 365
    const txns = this.transactions.filter(txn => txn.date > subDays(new Date(), days));

    if(!txns.length) {
      return this.bot.sendMessage(msg.chat.id, 'No transactions found for the specified period.');
    }

    const header = `Txn History (${period})\n${'='.repeat(30)}\n`;

    const message = txns
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(txn => {
        const date = txn.date.toLocaleDateString();
        const typeIcon = txn.type === 'debit' ? '💸' : '💰';
        const category = txn.category ? ` | ${txn.category}` : '';
        return `${typeIcon} ${date} | ${txn.type.toUpperCase()} ₹${txn.amount}${category}`;
      })
      .join('\n');
    
    const total = txns.reduce((sum, txn) => 
      sum + (txn.type === 'debit' ? -txn.amount : txn.amount), 0
    );

    const footer = `\n${'='.repeat(30)}\n📈 Net: ₹${total} (${txns.length} transactions)`;
 
    return this.bot.sendMessage(msg.chat.id, header + message + footer, { parse_mode: 'HTML' });
  }
  
  getCategorySplit(msg: TelegramBot.Message, args: string[]) {

  }

  sendError(msg: TelegramBot.Message, customMessage: string = 'Invalid command') {
    return this.bot.sendMessage(msg.chat.id, customMessage);
  }
}

export default ExpenseTrackerBot;
