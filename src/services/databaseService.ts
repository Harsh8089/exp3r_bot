import { subDays } from "date-fns";
import { Category, PrismaClient, Transaction, TransactionType, User } from "../generated/prisma";

export interface CategorySpend {
  categoryId: number | null;
  _sum: {
    amount: number | null;
  };
  _count: {
    id: number;
  };
}

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  getPrismaInstance(): PrismaClient {
    return this.prisma;
  }

  async findUser(userId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findFirst({
        where: { 
          id: BigInt(userId) 
        },
        select: {
          id: true,
          name: true,
          walletAmount: true, 
        }
      });
    } catch (error) {
      console.error('Error finding user:', error);
      throw new Error('Failed to find user');
    }
  }

  async createUser(userId: string, name: string, walletAmount: number): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          id: BigInt(userId),
          name,
          walletAmount
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUserWallet(userId: string, walletAmount: number): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: {
          id: BigInt(userId)
        },
        data: {
          walletAmount
        },
        select: {
          id: true,
          name: true,
          walletAmount: true,
        }
      });
    } catch (error) {
      console.error('Error updating user wallet:', error);
      throw new Error('Failed to update wallet');
    }
  }

  async incrementUserWallet(userId: string, amount: number): Promise<User | null> {
    try {
      return await this.prisma.user.update({
        where: {
          id: BigInt(userId)
        },
        data: {
          walletAmount: {
            increment: amount
          }
        },
        select: {
          id: true,
          name: true,
          walletAmount: true,
        }
      });
    } catch (error) {
      console.error('Error incrementing user wallet:', error);
      throw new Error('Failed to increment wallet');
    }
  }

  async decrementUserWallet(userId: string, amount: number): Promise<User | null> {
    try {
      const userInDb = await this.findUser(userId);

      if(!userInDb || userInDb.walletAmount < amount) {
        throw new Error('Insufficient balance');
      }

      return await this.prisma.user.update({
        where: { 
          id: BigInt(userId) 
        },
        data: {
          walletAmount: {
            decrement: amount
          }
        },
        select: {
          id: true,
          name: true,
          walletAmount: true,
        }
      });
    } catch (error) {
      console.error('Error incrementing user wallet:', error);
      throw new Error('Failed to decrement wallet');
    }
  }

  async findCategory(categoryName: string): Promise<Category | null> {
    try {
      return await this.prisma.category.findFirst({
        where: {
          name: {
            equals: categoryName,
            mode: 'insensitive'
          }
        }
      });
    } catch (error) {
      console.error('Error finding category:', error);
      throw new Error('Failed to find category');
    }
  }

  async createCategory(categoryName: string): Promise<Category> {
    try {
      return await this.prisma.category.create({
        data: { 
          name: categoryName.toLowerCase().trim() 
        }
      });
    } catch (error) {
      console.error('Error creating category:', error);
      throw new Error('Failed to create category');
    }
  }

  async getAllCategories(limit: number = 100): Promise<Category[]> {
    try {
      return this.prisma.category.findMany({
        take: limit,
        orderBy: {
          name: 'asc'
        }
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  async createTransaction() {

  }

  async getTransactionHistory(
    userId: string, 
    days: number = 365, 
    limit: number = 50
  ): Promise<Transaction[]> {
    try {
      return await this.prisma.transaction.findMany({
        where: {
          userId: BigInt(userId),
          date: {
            gte: subDays(new Date(), days)
          }
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  async getCategorySpendBreakdown(
    userId: string,
    days: number = 365,
  ): Promise<CategorySpend[]> {
    try {
      const categorySpends = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId: BigInt(userId),
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
        having: {
          categoryId: {
            not: null
          }
        },
        orderBy: {
          _sum: {
            amount: 'desc'
          }
        }
      });

      return categorySpends.map((item): CategorySpend => ({
        categoryId: item.categoryId,
        _sum: {
          amount: item._sum.amount
        },
        _count: {
          id: item._count.id
        }
      }));
    } catch (error) {
      console.error('Error fetching category breakdown:', error);
      throw new Error('Failed to fetch category breakdown');
    }
  }

  async getLatestTransaction(userId: string): Promise<Transaction | null> {
    try {
      return await this.prisma.transaction.findFirst({
        where: {
          userId: BigInt(userId)
        },
        orderBy: {
          date: 'desc'
        },
        select: {
          id: true,
          amount: true,
          type: true,
          categoryId: true,
          date: true,
          userId: true
        }
      })
    } catch (error) {
      console.error('Error fetching latest transaction:', error);
      throw new Error('Failed to fetch latest transaction');
    }
  }

  async processDebit(
    userId: string,
    amount: number,
    categoryId: number 
  ): Promise<{ user: User, transaction: Transaction }> {
    try {
      return await this.prisma.$transaction(async(prisma) => {
        const currentUser = await prisma.user.findFirst({
          where: {
            id: BigInt(userId)
          },
          select: {
            walletAmount: true
          }
        });

        if(!currentUser || currentUser?.walletAmount < amount) {
          throw new Error('Insufficient balance');
        }

        const user = await prisma.user.update({
          where: {
            id: BigInt(userId)
          },
          data: {
            walletAmount: {
              decrement: amount
            }
          },
          select: {
            id: true,
            name: true,
            walletAmount: true
          }
        });

        const transaction = await prisma.transaction.create({
          data: {
            userId: BigInt(userId),
            type: TransactionType.DEBIT,
            categoryId,
            amount,
            date: new Date()
          }
        }) ;

        return {
          user,
          transaction
        }
      })
    } catch (error) {
      console.error('Error processing debit:', error);
      throw error;
    }
  }

  async processCredit(
    userId: string,
    amount: number, 
  ): Promise<{ user: User, transaction: Transaction }> {
    try {
      return await this.prisma.$transaction(async(prisma) => {
        const user = await prisma.user.update({
          where: {
            id: BigInt(userId)
          },
          data: {
            walletAmount: {
              increment: amount
            }
          }
        });

        const transaction = await prisma.transaction.create({
          data: {
            userId: BigInt(userId),
            type: TransactionType.CREDIT,
            amount,
            date: new Date()
          }
        });

        return {
          user, 
          transaction
        }
      });
    } catch (error) {
      console.error('Error processing credit:', error);
      throw new Error('Failed to process credit transaction');
    }
  }

  async undoLastTransaction(
    userId: string,
    latestTxn: Transaction,
  ): Promise<User> {
    try {
      return await this.prisma.$transaction(async(prisma) => {
        await prisma.transaction.delete({
          where: {
            id: latestTxn.id
          }
        });

        const incrementAmount = latestTxn.type === TransactionType.DEBIT 
          ? latestTxn.amount 
          : -latestTxn.amount;
        
        const updatedUser = await prisma.user.update({
          where: {
            id: BigInt(userId)
          },
          data: {
            walletAmount: {
              increment: incrementAmount
            }
          },
          select: {
            id: true,
            name: true,
            walletAmount: true,
          }
        });

        return updatedUser;
      });
    } catch (error) {
      console.error('Error undoing transaction:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }
}