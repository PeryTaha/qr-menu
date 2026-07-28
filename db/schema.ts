import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  tableNo: integer("table_no").notNull(),
  status: text("status").notNull().default("new"),
  items: text("items").notNull(),
  note: text("note").notNull().default(""),
  total: integer("total").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  tableNo: integer("table_no").notNull(),
  allocations: text("allocations").notNull(),
  total: integer("total").notNull(),
  method: text("method").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  emoji: text("emoji").notNull().default("☕"),
  imageKey: text("image_key"),
  imageFocalX: integer("image_focal_x").notNull().default(50),
  imageFocalY: integer("image_focal_y").notNull().default(50),
  popular: integer("popular", { mode: "boolean" }).notNull().default(false),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const posPaymentRequests = sqliteTable("pos_payment_requests", {
  id: text("id").primaryKey(),
  tableNo: integer("table_no").notNull(),
  amount: integer("amount").notNull(),
  selections: text("selections").notNull(),
  status: text("status").notNull().default("pending"),
  paymentId: text("payment_id"),
  error: text("error").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tableSessions = sqliteTable("table_sessions", {
  tableNo: integer("table_no").primaryKey(),
  token: text("token").notNull().unique(),
  accessCode: text("access_code").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
