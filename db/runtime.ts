import { env } from "cloudflare:workers";

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
  ]);
}
