import { PrismaClient, TransactionType } from "../src/generated/prisma";
const prisma = new PrismaClient();

const user = [
  {
    id: 1,
    name: 'harsh jain',
    walletAmount: 0
  }
];

const transactions = [
  {
    userId: 1,
    type: TransactionType.SET_WALLET,
    amount: 3574.50,
    date: new Date()
  }, 
  {
    userId: 1,
    type: TransactionType.DEBIT,
    amount: 200,
    category: 'food',
    date: new Date()
  },
  {
    userId: 1,
    type: TransactionType.CREDIT,
    amount: 34.5,
    date: new Date()
  },
  {
    userId: 1,
    type: TransactionType.DEBIT,
    amount: 300,
    category: 'travel',
    date: new Date()
  },
  {    
    userId: 1,
    type: TransactionType.DEBIT,
    amount: 100,
    category: 'food',
    date: new Date()
  }
];

const category = [
  {
    name: 'food'
  },
  {
    name: 'travel'
  }
]

async function clearDb() {
  try {
    console.log('🧹 Clearing database...');

    await prisma.user.deleteMany({});
    console.log('✅ Cleared user table');

    await prisma.transaction.deleteMany({});
    console.log('✅ Cleared transactions table');

    await prisma.category.deleteMany({});
    console.log('✅ Cleared category table');
  } catch (error) {
    console.error('❌ Error clearing database:', error)
  }
}

async function seedUser() {
  try {
    for (const u of user) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: u
      });
    }
    console.log("✅ Users seeded.");
  } catch (error) {
    console.error('❌ Error seeding users:', error);
  }
}

async function seedCategories() {
  try {
    for (const c of category) {
      await prisma.category.create({
        data: {
          name: c.name
        }
      });
    }
    console.log("✅ Categories seeded.");
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
  }
}

async function seedTransactions() {
  try {
    for (const u of user) {
      for (const t of transactions) {
        let categoryId: number | null = null;
        if(t.category) {
          const category = await prisma.category.findFirst({
            where: {
              name: t.category
            },
            select: {
              id: true
            }
          });
          categoryId = category?.id || null;
        }

        await prisma.transaction.create({
          data: {
            userId: u.id,
            type: t.type,
            amount: t.amount,
            categoryId: categoryId,
            date: t.date
          }
        });
      }
    }
    console.log("✅ Transactions seeded.");
  } catch (error) {
    console.error('❌ Error seeding transactions:', error);
  }
}

clearDb()
.then(() => seedUser())
.then(() => seedCategories())
.then(() => seedTransactions())
.catch(error => console.error("❌ Something went wrong while seeding: ", error))
.finally(() => prisma.$disconnect());