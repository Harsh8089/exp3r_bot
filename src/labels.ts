enum Commands {
  Debit = '/d',
  Credit = '/c',
  Set = '/set',
  Past = '/past',
  Breakdown = '/br',
}

const commands: Record<Commands, {
  about: string,
  error: string,
  message: (amount?: number, wallet?: number) => string
}> = {
  [Commands.Debit]: {
    about: '/d <amount> <description> - Record a debit',
    error: '❌ Please provide amount: /d <amount> <category>',
    message: (amount?: number, wallet?: number) =>
    `💸 Debit added: ₹${amount}\n💳 Current balance: ₹${wallet?.toFixed(2)}`
  },
  [Commands.Credit]: {
    about: '/c <amount> - Record a credit',
    error: '❌ Please provide amount: /c <amount>',
    message: (amount?: number, wallet?: number) =>
    `💰 Credit added: ₹${amount}\n💳 Current balance: ₹${wallet?.toFixed(2)}`
  },
  [Commands.Set]: {
    about: '/set <amount> - Set wallet amount',
    error: '❌ Please provide amount: /set <amount>',
    message: (amount?: number, wallet?: number) =>
    `✅ Wallet balance set to ₹${wallet?.toFixed(2)}`
  },
  [Commands.Past]: {
    about: '/past [1d|1w|1m|1y] - Show transaction history',
    error: '',
    message: () => '',
  },
  [Commands.Breakdown]: {
    about: 'Category-wise expense breakdown',
    error: '',
    message: () => '',
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