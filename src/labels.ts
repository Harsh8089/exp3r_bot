enum Commands {
  Debit = '/d',
  Credit = '/c',
  Set = '/set',
  Past = '/past',
  Breakdown = '/br',
  Undo = '/un',
}

const commands: Record<Commands, {
  about: string,
  error: string,
  message: (amount?: number, wallet?: number) => string
}> = {
  [Commands.Debit]: {
    about: '/d <amount> <description> - Add a debit transaction with amount and category',
    error: '❌ Please provide amount: /d <amount> <category>',
    message: (amount?: number, wallet?: number) =>
      `💸 Debit added: ₹${amount}\n💳 Current balance: ₹${wallet?.toFixed(2)}`
  },
  [Commands.Credit]: {
    about: '/c <amount> - Add a credit transaction to increase wallet balance',
    error: '❌ Please provide amount: /c <amount>',
    message: (amount?: number, wallet?: number) =>
      `💰 Credit added: ₹${amount}\n💳 Current balance: ₹${wallet?.toFixed(2)}`
  },
  [Commands.Set]: {
    about: '/set <amount> - Set your wallet balance to a specific amount',
    error: '❌ Please provide amount: /set <amount>',
    message: (wallet?: number) =>
      `✅ Wallet balance set to ₹${wallet?.toFixed(2)}`
  },
  [Commands.Past]: {
    about: '/past [1d|1w|1m|1y] - View your transaction history for a period',
    error: 'No transactions found for the specified period.',
    message: () => '',
  },
  [Commands.Breakdown]: {
    about: 'Show a category-wise breakdown of your expenses',
    error: 'No transactions found for the specified period.',
    message: () => '',
  },
  [Commands.Undo]: {
    about: '/undo - Remove your most recent transaction',
    error: '❌ No transaction found to undo.',
    message: () => '✅ Latest transaction has been removed',
  }
}

const labels = {
  invalidAmount: '❌ Please provide a valid positive amount',
}

export {
  Commands,
  commands,
  labels,
}