import dotenv from "dotenv";
import ExpenseTrackerBot from "./utils";

dotenv.config({ path: '.env' });

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '') as string; 
const expenseTracker = new ExpenseTrackerBot(TELEGRAM_BOT_TOKEN, { polling: true });
const bot = expenseTracker.bot;
bot.on('message', (msg) => {
  expenseTracker.handleMessage(msg);
})

console.log('Bot started successfully!');