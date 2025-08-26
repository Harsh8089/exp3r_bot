import dotenv from 'dotenv';
import ExpenseTrackerBot from './utils.js';

dotenv.config({ path: '.env' });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '' as string; 
new ExpenseTrackerBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('Bot started successfully!');