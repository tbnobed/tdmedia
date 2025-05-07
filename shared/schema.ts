import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, varchar, json } from "drizzle-orm/pg-core";
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

// Media items
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: mediaTypeEnum("type").notNull(),
  playlistId: integer("playlist_id").references(() => playlists.id).notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration"),
  size: text("size"),
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
export const mediaAccess = pgTable("media_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  mediaId: integer("media_id").references(() => media.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
});

export const insertMediaAccessSchema = createInsertSchema(mediaAccess, {})
  .omit({ id: true, createdAt: true, createdById: true });

// Define relations
export const playlistsRelations = relations(playlists, ({ many }) => ({
  media: many(media)
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  playlist: one(playlists, { fields: [media.playlistId], references: [playlists.id] }),
  contacts: many(contacts),
  accessRights: many(mediaAccess)
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  media: one(media, { fields: [contacts.mediaId], references: [media.id] })
}));

export const usersRelations = relations(users, ({ many }) => ({
  accessibleMedia: many(mediaAccess, { relationName: 'userAccess' }),
  createdAccess: many(mediaAccess, { relationName: 'createdBy' })
}));

export const mediaAccessRelations = relations(mediaAccess, ({ one }) => ({
  user: one(users, { fields: [mediaAccess.userId], references: [users.id], relationName: 'userAccess' }),
  media: one(media, { fields: [mediaAccess.mediaId], references: [media.id] }),
  createdBy: one(users, { fields: [mediaAccess.createdById], references: [users.id], relationName: 'createdBy' })
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
