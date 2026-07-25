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
