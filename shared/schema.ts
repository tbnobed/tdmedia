import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
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

// Media categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertCategorySchema = createInsertSchema(categories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters")
}).omit({ id: true, createdAt: true });

// Media type enum
export const mediaTypeEnum = pgEnum('media_type', ['video', 'document', 'image', 'presentation']);

// Media items
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: mediaTypeEnum("type").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
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

// Define relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  media: many(media)
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  category: one(categories, { fields: [media.categoryId], references: [categories.id] }),
  contacts: many(contacts)
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  media: one(media, { fields: [contacts.mediaId], references: [media.id] })
}));

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Media = typeof media.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
