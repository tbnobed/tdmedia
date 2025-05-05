import { db } from "@db";
import { users, media, categories, contacts } from "@shared/schema";
import { eq, and, like, desc, asc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  createUser(userData: any): Promise<any>;
  
  // Category methods
  getCategories(): Promise<any[]>;
  getCategory(id: number): Promise<any>;
  createCategory(categoryData: any): Promise<any>;
  updateCategory(id: number, categoryData: any): Promise<any>;
  deleteCategory(id: number): Promise<void>;
  
  // Media methods
  getMedia(filters?: { search?: string, categoryId?: number, sort?: string }): Promise<any[]>;
  getMediaById(id: number): Promise<any>;
  createMedia(mediaData: any): Promise<any>;
  updateMedia(id: number, mediaData: any): Promise<any>;
  deleteMedia(id: number): Promise<void>;
  
  // Contact methods
  createContact(contactData: any): Promise<any>;
  getContacts(): Promise<any[]>;
  getContactById(id: number): Promise<any>;
  markContactAsRead(id: number): Promise<any>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // User methods
  async getUser(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }
  
  async getUserByUsername(username: string) {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
  }
  
  async getUserByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }
  
  async createUser(userData: any) {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  // Category methods
  async getCategories() {
    return await db.select().from(categories).orderBy(categories.name);
  }
  
  async getCategory(id: number) {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result[0] || null;
  }
  
  async createCategory(categoryData: any) {
    const [category] = await db.insert(categories).values(categoryData).returning();
    return category;
  }
  
  async updateCategory(id: number, categoryData: any) {
    const [category] = await db.update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }
  
  async deleteCategory(id: number) {
    await db.delete(categories).where(eq(categories.id, id));
  }
  
  // Media methods
  async getMedia(filters: { search?: string, categoryId?: number, sort?: string } = {}) {
    let query = db.select().from(media);
    
    if (filters.search) {
      query = query.where(
        like(media.title, `%${filters.search}%`)
      );
    }
    
    if (filters.categoryId && filters.categoryId > 0) {
      query = query.where(eq(media.categoryId, filters.categoryId));
    }
    
    if (filters.sort) {
      switch (filters.sort) {
        case 'newest':
          query = query.orderBy(desc(media.createdAt));
          break;
        case 'oldest':
          query = query.orderBy(asc(media.createdAt));
          break;
        case 'a-z':
          query = query.orderBy(asc(media.title));
          break;
        case 'z-a':
          query = query.orderBy(desc(media.title));
          break;
        default:
          query = query.orderBy(desc(media.createdAt));
      }
    } else {
      query = query.orderBy(desc(media.createdAt));
    }
    
    return await query;
  }
  
  async getMediaById(id: number) {
    const result = await db.query.media.findFirst({
      where: eq(media.id, id),
      with: {
        category: true
      }
    });
    
    return result || null;
  }
  
  async createMedia(mediaData: any) {
    const [newMedia] = await db.insert(media).values(mediaData).returning();
    return newMedia;
  }
  
  async updateMedia(id: number, mediaData: any) {
    const [updatedMedia] = await db.update(media)
      .set({ ...mediaData, updatedAt: new Date() })
      .where(eq(media.id, id))
      .returning();
    return updatedMedia;
  }
  
  async deleteMedia(id: number) {
    await db.delete(media).where(eq(media.id, id));
  }
  
  // Contact methods
  async createContact(contactData: any) {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }
  
  async getContacts() {
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }
  
  async getContactById(id: number) {
    const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    return result[0] || null;
  }
  
  async markContactAsRead(id: number) {
    const [contact] = await db.update(contacts)
      .set({ isRead: true })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }
}

// Create and export the storage instance
export const storage = new DatabaseStorage();
