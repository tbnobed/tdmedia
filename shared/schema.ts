import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, varchar, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User authentication tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "Username must be at least 3 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  password: (schema) => schema.min(8, "Password must be at least 8 characters")
}).omit({ id: true, isAdmin: true, createdAt: true });

// Media playlists
export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertPlaylistSchema = createInsertSchema(playlists, {
  name: (schema) => schema.min(2, "Playlist name must be at least 2 characters")
}).omit({ id: true, createdAt: true });

// Media type enum
export const mediaTypeEnum = pgEnum('media_type', ['video', 'document', 'image', 'presentation']);

// Content type enum
export const contentTypeEnum = pgEnum('content_type', ['film', 'tv_show', 'other']);

// Language enum
export const languageEnum = pgEnum('language', ['EN', 'ES', 'EN/ES', 'OTHER']);

// Media items
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: mediaTypeEnum("type").notNull(),
  // Removing the direct playlistId field - we'll use a join table instead
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration"),
  size: text("size"),
  contentType: contentTypeEnum("content_type").default('other'),
  language: languageEnum("language").default('EN').notNull(),
  year: integer("year"),
  seasonNumber: integer("season_number"),
  totalEpisodes: integer("total_episodes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertMediaSchema = createInsertSchema(media, {
  title: (schema) => schema.min(3, "Title must be at least 3 characters"),
  fileUrl: (schema) => schema.min(5, "File URL is required")
}).omit({ id: true, createdAt: true, updatedAt: true });

// Contact requests
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  message: text("message").notNull(),
  mediaId: integer("media_id").references(() => media.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isRead: boolean("is_read").default(false).notNull()
});

export const insertContactSchema = createInsertSchema(contacts, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  message: (schema) => schema.min(10, "Message must be at least 10 characters")
}).omit({ id: true, createdAt: true, isRead: true });

// Media access assignments - links users to media they can access
// Media-playlist join table for many-to-many relationship
export const mediaPlaylists = pgTable("media_playlists", {
  id: serial("id").primaryKey(),
  media_id: integer("media_id").references(() => media.id).notNull(),
  playlist_id: integer("playlist_id").references(() => playlists.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create a unique index on the join table to prevent duplicates
// Note: This will be applied when running the DB migrations

export const insertMediaPlaylistSchema = createInsertSchema(mediaPlaylists, {})
  .omit({ id: true, createdAt: true });

export const mediaAccess = pgTable("media_access", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  media_id: integer("media_id").references(() => media.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  created_by_id: integer("created_by_id").references(() => users.id).notNull(),
});

export const insertMediaAccessSchema = createInsertSchema(mediaAccess, {})
  .omit({ id: true, createdAt: true, created_by_id: true });

// Define relations
export const playlistsRelations = relations(playlists, ({ many }) => ({
  mediaPlaylists: many(mediaPlaylists),
}));

export const mediaRelations = relations(media, ({ many }) => ({
  playlists: many(mediaPlaylists),
  contacts: many(contacts),
  accessRights: many(mediaAccess)
}));

export const mediaPlaylistsRelations = relations(mediaPlaylists, ({ one }) => ({
  media: one(media, { fields: [mediaPlaylists.media_id], references: [media.id] }),
  playlist: one(playlists, { fields: [mediaPlaylists.playlist_id], references: [playlists.id] })
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  media: one(media, { fields: [contacts.mediaId], references: [media.id] })
}));

export const usersRelations = relations(users, ({ many }) => ({
  accessibleMedia: many(mediaAccess, { relationName: 'userAccess' }),
  createdAccess: many(mediaAccess, { relationName: 'createdBy' })
}));

export const mediaAccessRelations = relations(mediaAccess, ({ one }) => ({
  user: one(users, { fields: [mediaAccess.user_id], references: [users.id], relationName: 'userAccess' }),
  media: one(media, { fields: [mediaAccess.media_id], references: [media.id] }),
  createdBy: one(users, { fields: [mediaAccess.created_by_id], references: [users.id], relationName: 'createdBy' })
}));

// Session store table used by express-session
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull()
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Media = typeof media.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Contact = typeof contacts.$inferSelect;
export type MediaAccess = typeof mediaAccess.$inferSelect;
export type InsertMediaAccess = z.infer<typeof insertMediaAccessSchema>;
export type MediaPlaylist = typeof mediaPlaylists.$inferSelect;
export type InsertMediaPlaylist = z.infer<typeof insertMediaPlaylistSchema>;
