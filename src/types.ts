interface Transaction {
  id: number,
  type: 'credit' | 'debit',
  amount: number,
  category?: string
  date: Date
}

export { Transaction };