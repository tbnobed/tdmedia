import { db, executeRawSQL } from "@db";
import { users, media, playlists, contacts, mediaAccess, session as sessionTable, mediaPlaylists } from "@shared/schema";
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
  
  // Playlist methods
  getPlaylists(): Promise<any[]>;
  getPlaylist(id: number): Promise<any>;
  createPlaylist(playlistData: any): Promise<any>;
  updatePlaylist(id: number, playlistData: any): Promise<any>;
  deletePlaylist(id: number): Promise<void>;
  
  // Media methods
  getMedia(filters?: { search?: string, playlistId?: number, sort?: string, userId?: number }): Promise<any[]>;
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
    await db.delete(mediaAccess).where(eq(mediaAccess.user_id, id));
    
    // Then delete the user
    await db.delete(users).where(eq(users.id, id));
  }
  
  // Playlist methods
  async getPlaylists() {
    return await db.select().from(playlists).orderBy(playlists.name);
  }
  
  async getPlaylist(id: number) {
    const result = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
    return result[0] || null;
  }
  
  async createPlaylist(playlistData: any) {
    const [playlist] = await db.insert(playlists).values(playlistData).returning();
    return playlist;
  }
  
  async updatePlaylist(id: number, playlistData: any) {
    const [playlist] = await db.update(playlists)
      .set(playlistData)
      .where(eq(playlists.id, id))
      .returning();
    return playlist;
  }
  
  async deletePlaylist(id: number) {
    // First check if there's a default playlist we can move media to
    let defaultPlaylist = await db.query.playlists.findFirst({
      where: and(
        ne(playlists.id, id),
        eq(playlists.name, "Uncategorized")
      )
    });
    
    // If no default playlist exists, create one
    if (!defaultPlaylist) {
      const [newPlaylist] = await db.insert(playlists)
        .values({
          name: "Uncategorized",
          description: "Default playlist for uncategorized media"
        })
        .returning();
      defaultPlaylist = newPlaylist;
    }
    
    // Update media_playlists entries to point to the default playlist
    // First, get all media_playlist entries for the deleted playlist using raw SQL
    const mediaInDeletedPlaylist = await executeRawSQL(`
      SELECT media_id as "mediaId" FROM media_playlists 
      WHERE playlist_id = $1
    `, [id]);
    
    // Convert to expected format
    const mediaItems = mediaInDeletedPlaylist.rows;
    
    // For each media in the deleted playlist, add an entry to the default playlist
    // (only if it doesn't already exist)
    for (const item of mediaItems) {
      const existingEntry = await db.select()
        .from(mediaPlaylists)
        .where(and(
          eq(mediaPlaylists.media_id, item.mediaId),
          eq(mediaPlaylists.playlist_id, defaultPlaylist.id)
        ))
        .limit(1);
      
      // Only add if not already in the default playlist
      if (existingEntry.length === 0) {
        await db.insert(mediaPlaylists).values({
          media_id: item.mediaId,
          playlist_id: defaultPlaylist.id
        });
      }
    }
    
    // Delete all media_playlist entries for the deleted playlist
    await db.delete(mediaPlaylists).where(eq(mediaPlaylists.playlist_id, id));
      
    // Now we can safely delete the playlist
    await db.delete(playlists).where(eq(playlists.id, id));
  }
  
  // Media methods
  async getMedia(filters: { search?: string, playlistId?: number, sort?: string, userId?: number } = {}) {
    // For regular clients, we need to limit media to what they have access to
    if (filters.userId) {
      // If a non-admin user ID is provided, get only the media they have access to
      const accessibleMediaIds = await db.select({ id: media.id })
        .from(media)
        .innerJoin(mediaAccess, eq(media.id, mediaAccess.media_id))
        .where(eq(mediaAccess.user_id, filters.userId));
      
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
      
      if (filters.playlistId && filters.playlistId > 0) {
        // Use raw SQL to avoid column naming inconsistencies
        const results = await executeRawSQL(`
          SELECT m.* FROM media m
          INNER JOIN media_playlists mp ON m.id = mp.media_id
          WHERE mp.playlist_id = $1
          AND m.id = ANY($2)
          ${filters.search ? "AND m.title LIKE $3" : ""}
          ORDER BY m.created_at DESC
        `, [filters.playlistId, mediaIds, filters.search ? `%${filters.search}%` : undefined]);
        
        return results.rows;
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
      
      if (filters.playlistId && filters.playlistId > 0) {
        // Use raw SQL to avoid column naming inconsistencies
        const results = await executeRawSQL(`
          SELECT m.* FROM media m
          INNER JOIN media_playlists mp ON m.id = mp.media_id
          WHERE mp.playlist_id = $1
          ${filters.search ? "AND m.title LIKE $2" : ""}
          ORDER BY m.created_at DESC
        `, [filters.playlistId, filters.search ? `%${filters.search}%` : undefined]);
        
        return results.rows;
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
    // Get the media item
    const result = await db.query.media.findFirst({
      where: eq(media.id, id)
    });
    
    if (!result) {
      return null;
    }
    
    // Get the playlists associated with this media using raw SQL to avoid column name issues
    const playlistsData = await executeRawSQL(`
      SELECT 
        mp.media_id as "mediaId", 
        mp.playlist_id as "playlistId", 
        p.name as "playlistName", 
        p.description as "playlistDescription"
      FROM media_playlists mp
      INNER JOIN playlists p ON mp.playlist_id = p.id
      WHERE mp.media_id = $1
    `, [id]);
    
    // Return the media with its playlists
    return {
      ...result,
      playlists: playlistsData.rows
    };
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
      media_id: mediaAccess.media_id,
      user_id: mediaAccess.user_id,
      createdAt: mediaAccess.createdAt,
      created_by_id: mediaAccess.created_by_id,
      media: media
    })
    .from(mediaAccess)
    .innerJoin(media, eq(mediaAccess.media_id, media.id))
    .where(eq(mediaAccess.user_id, userId))
    .orderBy(desc(mediaAccess.createdAt));
  }
  
  async getMediaAccessByMedia(mediaId: number) {
    return await db.select({
      id: mediaAccess.id,
      media_id: mediaAccess.media_id,
      user_id: mediaAccess.user_id,
      user: users,
      createdAt: mediaAccess.createdAt,
      created_by_id: mediaAccess.created_by_id
    })
    .from(mediaAccess)
    .innerJoin(users, eq(mediaAccess.user_id, users.id))
    .where(eq(mediaAccess.media_id, mediaId))
    .orderBy(users.username);
  }
  
  async assignMediaToUser(mediaId: number, userId: number, createdById: number) {
    // Check if the access already exists
    const existing = await db.select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.media_id, mediaId),
        eq(mediaAccess.user_id, userId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0]; // Already exists
    }
    
    // Create new access
    const [access] = await db.insert(mediaAccess)
      .values({
        media_id: mediaId,
        user_id: userId,
        created_by_id: createdById
      })
      .returning();
    
    return access;
  }
  
  async removeMediaFromUser(mediaId: number, userId: number) {
    await db.delete(mediaAccess)
      .where(and(
        eq(mediaAccess.media_id, mediaId),
        eq(mediaAccess.user_id, userId)
      ));
  }
  
  async getMediaAccessUsers(mediaId: number) {
    const results = await db.select({
      id: users.id,
      username: users.username,
      email: users.email
    })
    .from(users)
    .innerJoin(mediaAccess, eq(mediaAccess.user_id, users.id))
    .where(eq(mediaAccess.media_id, mediaId))
    .orderBy(users.username);
    
    return results;
  }
  
  // Remove all media access records for a specific media item
  async removeAllMediaAccess(mediaId: number) {
    await db.delete(mediaAccess).where(eq(mediaAccess.media_id, mediaId));
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
