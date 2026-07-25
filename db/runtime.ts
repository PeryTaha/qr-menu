import { env } from "cloudflare:workers";
import { DEFAULT_MENU_ITEMS } from "./default-menu";

export async function ensureAppSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        table_no INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        items TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        table_no INTEGER NOT NULL,
        allocations TEXT NOT NULL,
        total INTEGER NOT NULL,
        method TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS payments_table_no_idx ON payments (table_no, created_at DESC)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        emoji TEXT NOT NULL DEFAULT '☕',
        popular INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS menu_items_sort_idx ON menu_items (sort_order, id)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS table_sessions (
        table_no INTEGER PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        access_code TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS table_sessions_active_idx ON table_sessions (active, expires_at)",
    ),
  ]);

  const seedState = await db
    .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'menu_items'")
    .first<{ seq: number }>();
  if (!seedState) {
    await db.batch(
      DEFAULT_MENU_ITEMS.map((item) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO menu_items
              (id, name, description, category, price, emoji, popular, available, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.id,
            item.name,
            item.description,
            item.category,
            item.price,
            item.emoji,
            item.popular ? 1 : 0,
            item.available ? 1 : 0,
            item.sortOrder,
          ),
      ),
    );
  }
}
