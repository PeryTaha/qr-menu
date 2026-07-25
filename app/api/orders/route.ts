import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";
import { isAuthorizedTableSession } from "@/app/table-session";
import { ensureAppSchema } from "@/db/runtime";

type OrderItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type PaymentAllocation = {
  orderId: string;
  itemId: number;
  quantity: number;
};

const allowedStatuses = new Set([
  "new",
  "preparing",
  "ready",
  "served",
  "closed",
]);

export async function GET(request: Request) {
  try {
    await ensureAppSchema();
    const url = new URL(request.url);
    const requestedTable = Number(url.searchParams.get("table"));
    const hasTableFilter =
      Number.isInteger(requestedTable) && requestedTable > 0;
    if (
      (hasTableFilter &&
        !(await isAuthorizedTableSession(request, requestedTable))) ||
      (!hasTableFilter && !(await isStaffRequest(request)))
    ) {
      return Response.json(
        {
          error: hasTableFilter
            ? "Masa oturumu kapalı veya süresi dolmuş."
            : "Personel oturumu gerekli.",
        },
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

    const parsedOrders = result.results.map((row) => ({
      ...row,
      id: String(row.id),
      total: Number(row.total),
      items: JSON.parse(String(row.items)) as OrderItem[],
    }));
    const activeOrderIds = new Set(parsedOrders.map((order) => order.id));
    const paymentQuery = hasTableFilter
      ? env.DB.prepare(
          `SELECT allocations
           FROM payments
           WHERE table_no = ?
           ORDER BY created_at DESC
           LIMIT 1000`,
        ).bind(requestedTable)
      : env.DB.prepare(
          `SELECT allocations
           FROM payments
           ORDER BY created_at DESC
           LIMIT 5000`,
        );
    const paymentResult = await paymentQuery.all();
    const paidByOrder = new Map<string, Map<number, number>>();

    for (const row of paymentResult.results) {
      const allocations = JSON.parse(
        String(row.allocations),
      ) as PaymentAllocation[];
      for (const allocation of allocations) {
        if (!activeOrderIds.has(allocation.orderId)) continue;
        const orderPayments =
          paidByOrder.get(allocation.orderId) ?? new Map<number, number>();
        orderPayments.set(
          allocation.itemId,
          (orderPayments.get(allocation.itemId) ?? 0) + allocation.quantity,
        );
        paidByOrder.set(allocation.orderId, orderPayments);
      }
    }

    const orders = parsedOrders.map((order) => {
      const orderPayments = paidByOrder.get(order.id) ?? new Map<number, number>();
      const paidItems = Object.fromEntries(orderPayments);
      const paidTotal = order.items.reduce(
        (sum, item) =>
          sum +
          item.price *
            Math.min(item.quantity, orderPayments.get(item.id) ?? 0),
        0,
      );
      return {
        ...order,
        paidItems,
        paidTotal,
        remainingTotal: Math.max(0, order.total - paidTotal),
      };
    });

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
      items?: Array<{ id?: number; quantity?: number }>;
      note?: string;
    };
    const tableNo = Number(payload.tableNo);
    const requestedItems = Array.isArray(payload.items)
      ? payload.items.filter(
          (item) =>
            Number.isInteger(item.id) &&
            Number.isInteger(item.quantity) &&
            Number(item.quantity) > 0 &&
            Number(item.quantity) <= 20,
        )
      : [];

    if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 999) {
      return Response.json(
        { error: "Geçerli bir masa numarası gerekli." },
        { status: 400 },
      );
    }
    if (!requestedItems.length || requestedItems.length > 50) {
      return Response.json({ error: "Sepet boş." }, { status: 400 });
    }

    await ensureAppSchema();
    if (!(await isAuthorizedTableSession(request, tableNo))) {
      return Response.json(
        { error: "Masa oturumu kapalı veya süresi dolmuş." },
        { status: 403 },
      );
    }
    const quantities = new Map<number, number>();
    for (const item of requestedItems) {
      const id = Number(item.id);
      quantities.set(id, (quantities.get(id) ?? 0) + Number(item.quantity));
    }
    if (Array.from(quantities.values()).some((quantity) => quantity > 20)) {
      return Response.json(
        { error: "Bir üründen en fazla 20 adet sipariş verilebilir." },
        { status: 400 },
      );
    }

    const ids = Array.from(quantities.keys());
    const menuResult = await env.DB.prepare(
      `SELECT id, name, price
       FROM menu_items
       WHERE available = 1 AND id IN (${ids.map(() => "?").join(", ")})`,
    )
      .bind(...ids)
      .all();
    const menuById = new Map(
      menuResult.results.map((item) => [
        Number(item.id),
        {
          id: Number(item.id),
          name: String(item.name),
          price: Number(item.price),
        },
      ]),
    );
    if (menuById.size !== ids.length) {
      return Response.json(
        { error: "Sepette satıştan kaldırılmış bir ürün var. Menüyü yenileyin." },
        { status: 409 },
      );
    }
    const items: OrderItem[] = ids.map((id) => ({
      ...menuById.get(id)!,
      quantity: quantities.get(id)!,
    }));

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

    await ensureAppSchema();
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

    if (isTableClose) {
      const openOrders = await env.DB.prepare(
        `SELECT id, items, total
         FROM orders
         WHERE table_no = ? AND status != 'closed'`,
      )
        .bind(tableNo)
        .all();
      const payments = await env.DB.prepare(
        "SELECT allocations FROM payments WHERE table_no = ?",
      )
        .bind(tableNo)
        .all();
      const activeOrderIds = new Set(
        openOrders.results.map((order) => String(order.id)),
      );
      let paidTotal = 0;
      for (const payment of payments.results) {
        const allocations = JSON.parse(
          String(payment.allocations),
        ) as Array<PaymentAllocation & { unitPrice?: number }>;
        for (const allocation of allocations) {
          if (activeOrderIds.has(allocation.orderId)) {
            paidTotal += Number(allocation.unitPrice ?? 0) * allocation.quantity;
          }
        }
      }
      const accountTotal = openOrders.results.reduce(
        (sum, order) => sum + Number(order.total),
        0,
      );
      if (paidTotal < accountTotal) {
        return Response.json(
          {
            error: "Masa kapatılmadan önce kalan hesabın tamamı ödenmeli.",
            remainingTotal: accountTotal - paidTotal,
          },
          { status: 409 },
        );
      }
    }

    const result = isTableClose
      ? (
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE orders SET status = 'closed' WHERE table_no = ? AND status != 'closed'",
            ).bind(tableNo),
            env.DB.prepare(
              "UPDATE table_sessions SET active = 0 WHERE table_no = ?",
            ).bind(tableNo),
          ])
        )[0]
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
