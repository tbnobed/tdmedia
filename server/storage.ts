import { db } from "@db";
import { users, media, categories, contacts, mediaAccess, session as sessionTable } from "@shared/schema";
import { eq, and, like, desc, asc, inArray, ne } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";
import { sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  createUser(userData: any): Promise<any>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<any[]>;
  getNonAdminUsers(): Promise<any[]>;
  updateUserCredentials(userId: number, newPasswordHash: string): Promise<any>;
  
  // Category methods
  getCategories(): Promise<any[]>;
  getCategory(id: number): Promise<any>;
  createCategory(categoryData: any): Promise<any>;
  updateCategory(id: number, categoryData: any): Promise<any>;
  deleteCategory(id: number): Promise<void>;
  
  // Media methods
  getMedia(filters?: { search?: string, categoryId?: number, sort?: string, userId?: number }): Promise<any[]>;
  getMediaById(id: number): Promise<any>;
  createMedia(mediaData: any): Promise<any>;
  updateMedia(id: number, mediaData: any): Promise<any>;
  deleteMedia(id: number): Promise<void>;
  
  // Media Access methods
  getMediaAccessByUser(userId: number): Promise<any[]>;
  getMediaAccessByMedia(mediaId: number): Promise<any[]>;
  assignMediaToUser(mediaId: number, userId: number, createdById: number): Promise<any>;
  removeMediaFromUser(mediaId: number, userId: number): Promise<void>;
  removeAllMediaAccess(mediaId: number): Promise<void>;
  getMediaAccessUsers(mediaId: number): Promise<any[]>;
  
  // Contact methods
  createContact(contactData: any): Promise<any>;
  getContacts(): Promise<any[]>;
  getContactById(id: number): Promise<any>;
  markContactAsRead(id: number): Promise<any>;
  
  // Session store
  sessionStore: any; // Using any type to avoid SessionStore type issues
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Using any to resolve type issues
  
  constructor() {
    // Immediately create the session table synchronously
    this.createSessionTable();
    
    // Use the default session table name to avoid conflicts
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      // Enable automatic table creation as a backup
      createTableIfMissing: true,
      // Use default pruning interval
      pruneSessionInterval: 60 * 15 // Prune expired sessions every 15 min
    });
  }
  
  /**
   * Create the session table synchronously using a direct SQL query
   * to ensure it exists before we try to use it with the session store.
   */
  private createSessionTable() {
    try {
      // Use pool directly for synchronous execution
      pool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        );
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `).then(() => {
        console.log("Session table created for connect-pg-simple");
      }).catch(err => {
        console.error("Error creating session table:", err);
      });
    } catch (error) {
      console.error("Error with session table setup:", error);
    }
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
  
  async getAllUsers() {
    try {
      const result = await db.select().from(users).orderBy(users.username);
      return result.map(user => {
        // Don't return password hashes
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }
  
  async getNonAdminUsers() {
    return await db.select().from(users).where(eq(users.isAdmin, false)).orderBy(users.username);
  }
  
  async updateUserCredentials(userId: number, newPasswordHash: string) {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ 
          password: newPasswordHash,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error('Error updating user credentials:', error);
      throw new Error('Failed to update user credentials');
    }
  }
  
  async deleteUser(id: number) {
    // First delete any media access entries for this user
    await db.delete(mediaAccess).where(eq(mediaAccess.userId, id));
    
    // Then delete the user
    await db.delete(users).where(eq(users.id, id));
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
    // First check if there's a default category we can move media to
    let defaultCategory = await db.query.categories.findFirst({
      where: and(
        ne(categories.id, id),
        eq(categories.name, "Uncategorized")
      )
    });
    
    // If no default category exists, create one
    if (!defaultCategory) {
      const [newCategory] = await db.insert(categories)
        .values({
          name: "Uncategorized",
          description: "Default category for uncategorized media"
        })
        .returning();
      defaultCategory = newCategory;
    }
    
    // Move all media from the to-be-deleted category to the default category
    await db.update(media)
      .set({ categoryId: defaultCategory.id })
      .where(eq(media.categoryId, id));
      
    // Now we can safely delete the category
    await db.delete(categories).where(eq(categories.id, id));
  }
  
  // Media methods
  async getMedia(filters: { search?: string, categoryId?: number, sort?: string, userId?: number } = {}) {
    // For regular clients, we need to limit media to what they have access to
    if (filters.userId) {
      // If a non-admin user ID is provided, get only the media they have access to
      const accessibleMediaIds = await db.select({ id: media.id })
        .from(media)
        .innerJoin(mediaAccess, eq(media.id, mediaAccess.mediaId))
        .where(eq(mediaAccess.userId, filters.userId));
      
      // If user has no media access, return empty array
      if (accessibleMediaIds.length === 0) {
        return [];
      }
      
      // Get the list of media IDs this user can access
      const mediaIds = accessibleMediaIds.map((item: { id: number }) => item.id);
      
      // Build a query using these media IDs
      let query = db.select().from(media).where(inArray(media.id, mediaIds));
      
      // Apply additional filters
      if (filters.search) {
        query = query.where(like(media.title, `%${filters.search}%`));
      }
      
      if (filters.categoryId && filters.categoryId > 0) {
        query = query.where(eq(media.categoryId, filters.categoryId));
      }
      
      // Apply sorting
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
    } else {
      // For admin users, return all media with filters
      let query = db.select().from(media);
      
      if (filters.search) {
        query = query.where(like(media.title, `%${filters.search}%`));
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
  
  // Media Access methods
  async getMediaAccessByUser(userId: number) {
    return await db.select({
      id: mediaAccess.id,
      mediaId: mediaAccess.mediaId,
      userId: mediaAccess.userId,
      createdAt: mediaAccess.createdAt,
      createdById: mediaAccess.createdById,
      media: media
    })
    .from(mediaAccess)
    .innerJoin(media, eq(mediaAccess.mediaId, media.id))
    .where(eq(mediaAccess.userId, userId))
    .orderBy(desc(mediaAccess.createdAt));
  }
  
  async getMediaAccessByMedia(mediaId: number) {
    return await db.select({
      id: mediaAccess.id,
      mediaId: mediaAccess.mediaId,
      userId: mediaAccess.userId,
      user: users,
      createdAt: mediaAccess.createdAt,
      createdById: mediaAccess.createdById
    })
    .from(mediaAccess)
    .innerJoin(users, eq(mediaAccess.userId, users.id))
    .where(eq(mediaAccess.mediaId, mediaId))
    .orderBy(users.username);
  }
  
  async assignMediaToUser(mediaId: number, userId: number, createdById: number) {
    // Check if the access already exists
    const existing = await db.select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.mediaId, mediaId),
        eq(mediaAccess.userId, userId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0]; // Already exists
    }
    
    // Create new access
    const [access] = await db.insert(mediaAccess)
      .values({
        mediaId,
        userId,
        createdById
      })
      .returning();
    
    return access;
  }
  
  async removeMediaFromUser(mediaId: number, userId: number) {
    await db.delete(mediaAccess)
      .where(and(
        eq(mediaAccess.mediaId, mediaId),
        eq(mediaAccess.userId, userId)
      ));
  }
  
  async getMediaAccessUsers(mediaId: number) {
    const results = await db.select({
      id: users.id,
      username: users.username,
      email: users.email
    })
    .from(users)
    .innerJoin(mediaAccess, eq(mediaAccess.userId, users.id))
    .where(eq(mediaAccess.mediaId, mediaId))
    .orderBy(users.username);
    
    return results;
  }
  
  // Remove all media access records for a specific media item
  async removeAllMediaAccess(mediaId: number) {
    await db.delete(mediaAccess).where(eq(mediaAccess.mediaId, mediaId));
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
