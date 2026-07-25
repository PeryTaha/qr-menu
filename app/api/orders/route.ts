import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";

type OrderItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

const allowedStatuses = new Set([
  "new",
  "preparing",
  "ready",
  "served",
  "closed",
]);

async function ensureSchema() {
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
  ]);
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const requestedTable = Number(url.searchParams.get("table"));
    const hasTableFilter =
      Number.isInteger(requestedTable) && requestedTable > 0;
    if (!hasTableFilter && !(await isStaffRequest(request))) {
      return Response.json(
        { error: "Personel oturumu gerekli." },
        { status: 401 },
      );
    }
    const query = hasTableFilter
      ? env.DB.prepare(
          `SELECT id, table_no AS tableNo, status, items, note, total,
            created_at AS createdAt
           FROM orders
           WHERE status != 'closed' AND table_no = ?
           ORDER BY created_at DESC
           LIMIT 100`,
        ).bind(requestedTable)
      : env.DB.prepare(
          `SELECT id, table_no AS tableNo, status, items, note, total,
            created_at AS createdAt
           FROM orders
           WHERE status != 'closed'
           ORDER BY created_at DESC
           LIMIT 100`,
        );
    const result = await query.all();

    const orders = result.results.map((row) => ({
      ...row,
      items: JSON.parse(String(row.items)),
    }));

    return Response.json({ orders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Siparişler alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      tableNo?: number;
      items?: OrderItem[];
      note?: string;
    };
    const tableNo = Number(payload.tableNo);
    const items = Array.isArray(payload.items)
      ? payload.items.filter(
          (item) =>
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            Number.isFinite(item.price),
        )
      : [];

    if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 999) {
      return Response.json(
        { error: "Geçerli bir masa numarası gerekli." },
        { status: 400 },
      );
    }
    if (!items.length) {
      return Response.json({ error: "Sepet boş." }, { status: 400 });
    }

    await ensureSchema();
    const id = crypto.randomUUID();
    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const note = String(payload.note ?? "").trim().slice(0, 300);

    await env.DB.prepare(
      `INSERT INTO orders (id, table_no, status, items, note, total)
       VALUES (?, ?, 'new', ?, ?, ?)`,
    )
      .bind(id, tableNo, JSON.stringify(items), note, total)
      .run();

    return Response.json({ id, status: "new" }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sipariş oluşturulamadı." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    const payload = (await request.json()) as {
      id?: string;
      tableNo?: number;
      status?: string;
    };
    const id = String(payload.id ?? "");
    const tableNo = Number(payload.tableNo);
    const status = String(payload.status ?? "");

    if (!allowedStatuses.has(status)) {
      return Response.json(
        { error: "Geçersiz sipariş güncellemesi." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const isTableClose =
      status === "closed" &&
      Number.isInteger(tableNo) &&
      tableNo > 0;
    if (!id && !isTableClose) {
      return Response.json(
        { error: "Sipariş veya masa numarası gerekli." },
        { status: 400 },
      );
    }

    const result = isTableClose
      ? await env.DB.prepare(
          "UPDATE orders SET status = 'closed' WHERE table_no = ? AND status != 'closed'",
        )
          .bind(tableNo)
          .run()
      : await env.DB.prepare(
          "UPDATE orders SET status = ? WHERE id = ?",
        )
          .bind(status, id)
          .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    return Response.json({
      id: isTableClose ? undefined : id,
      tableNo: isTableClose ? tableNo : undefined,
      status,
      changed: result.meta.changes,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sipariş güncellenemedi." },
      { status: 500 },
    );
  }
}
