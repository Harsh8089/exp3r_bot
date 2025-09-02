import { LRUCache } from "lru-cache";
import { User } from "../generated/prisma";

interface UserData {
  id: string;
  name: string;
  walletAmount: number;
  lastUpdated: number;
}

interface CategoryData {
  id: number;
  name: string;
}

export class CacheService {
  private userCache: LRUCache<string, UserData>;
  private categoryCache: LRUCache<string, CategoryData>;

  constructor() {
    this.userCache = new LRUCache({
      max: 100,
      ttl: 5 * 60 * 1000
    });

    this.categoryCache = new LRUCache({
      max: 500,
      ttl: 30 * 60 * 1000
    });
  }

  getUser(userId: string): UserData | undefined {
    return this.userCache.get(userId);
  }

  setUser(userId: string, userData: UserData): void {
    this.userCache.set(userId, userData);
  }

  updateUser(userId: string, userData: User) {
    const cached = this.userCache.get(userId);
    if(cached) {
      const updated = { 
        ...cached, 
        ...userData, 
        id: userData.id.toString(), 
        lastUpdated: Date.now() 
      };
      this.userCache.set(userId, updated);      
    } else {
      this.setUser(userId, {
        ...userData, 
        id: userData.id.toString(),
        lastUpdated: Date.now()
      });
    }
  }

  deleteUser(userId: string): void {
    this.userCache.delete(userId);
  }

  getCategory(categoryName: string): CategoryData | undefined {
    return this.categoryCache.get(categoryName);
  }

  setCategory(categoryName: string, categoryData: CategoryData): void {
    this.categoryCache.set(categoryName, categoryData);
  }
}