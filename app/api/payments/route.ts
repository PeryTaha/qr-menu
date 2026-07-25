import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";
import { ensureAppSchema } from "@/db/runtime";

type OrderItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type PaymentSelection = {
  orderId?: string;
  itemId?: number;
  quantity?: number;
};

type PaymentAllocation = {
  orderId: string;
  itemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

export async function POST(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as {
      tableNo?: number;
      selections?: PaymentSelection[];
      method?: string;
    };
    const tableNo = Number(payload.tableNo);
    const method = payload.method === "cash" ? "cash" : "card";
    const selections = Array.isArray(payload.selections)
      ? payload.selections
      : [];

    if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 999) {
      return Response.json(
        { error: "Geçerli bir masa numarası gerekli." },
        { status: 400 },
      );
    }
    if (!selections.length || selections.length > 100) {
      return Response.json(
        { error: "Ödeme için en az bir ürün seçin." },
        { status: 400 },
      );
    }

    await ensureAppSchema();
    const orderResult = await env.DB.prepare(
      `SELECT id, items, total
       FROM orders
       WHERE table_no = ? AND status != 'closed'`,
    )
      .bind(tableNo)
      .all();
    if (!orderResult.results.length) {
      return Response.json({ error: "Açık masa hesabı bulunamadı." }, { status: 404 });
    }

    const orders = new Map(
      orderResult.results.map((row) => [
        String(row.id),
        {
          id: String(row.id),
          total: Number(row.total),
          items: JSON.parse(String(row.items)) as OrderItem[],
        },
      ]),
    );
    const paymentResult = await env.DB.prepare(
      "SELECT allocations FROM payments WHERE table_no = ?",
    )
      .bind(tableNo)
      .all();
    const alreadyPaid = new Map<string, number>();

    for (const row of paymentResult.results) {
      const allocations = JSON.parse(
        String(row.allocations),
      ) as PaymentAllocation[];
      for (const allocation of allocations) {
        if (!orders.has(allocation.orderId)) continue;
        const key = `${allocation.orderId}:${allocation.itemId}`;
        alreadyPaid.set(
          key,
          (alreadyPaid.get(key) ?? 0) + allocation.quantity,
        );
      }
    }

    const requested = new Map<string, PaymentSelection>();
    for (const selection of selections) {
      const orderId = String(selection.orderId ?? "");
      const itemId = Number(selection.itemId);
      const quantity = Number(selection.quantity);
      if (
        !orderId ||
        !Number.isInteger(itemId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return Response.json(
          { error: "Geçersiz ürün veya adet seçimi." },
          { status: 400 },
        );
      }
      const key = `${orderId}:${itemId}`;
      requested.set(key, {
        orderId,
        itemId,
        quantity: Number(requested.get(key)?.quantity ?? 0) + quantity,
      });
    }

    const allocations: PaymentAllocation[] = [];
    let total = 0;
    for (const selection of requested.values()) {
      const orderId = String(selection.orderId);
      const itemId = Number(selection.itemId);
      const quantity = Number(selection.quantity);
      const order = orders.get(orderId);
      const item = order?.items.find((candidate) => candidate.id === itemId);
      if (!order || !item) {
        return Response.json(
          { error: "Seçilen ürün açık masa hesabında bulunamadı." },
          { status: 409 },
        );
      }

      const key = `${orderId}:${itemId}`;
      const remainingQuantity = item.quantity - (alreadyPaid.get(key) ?? 0);
      if (quantity > remainingQuantity) {
        return Response.json(
          { error: `${item.name} için ödenmemiş adet değişti. Hesabı yenileyin.` },
          { status: 409 },
        );
      }

      allocations.push({
        orderId,
        itemId,
        name: item.name,
        quantity,
        unitPrice: item.price,
      });
      total += item.price * quantity;
    }

    if (!total) {
      return Response.json(
        { error: "Ödeme tutarı sıfır olamaz." },
        { status: 400 },
      );
    }

    const paymentId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO payments (id, table_no, allocations, total, method)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(paymentId, tableNo, JSON.stringify(allocations), total, method)
      .run();

    const accountTotal = Array.from(orders.values()).reduce(
      (sum, order) => sum + order.total,
      0,
    );
    const paidBefore = Array.from(alreadyPaid.entries()).reduce(
      (sum, [key, quantity]) => {
        const separator = key.lastIndexOf(":");
        const orderId = key.slice(0, separator);
        const itemId = Number(key.slice(separator + 1));
        const item = orders
          .get(orderId)
          ?.items.find((candidate) => candidate.id === itemId);
        return sum + (item?.price ?? 0) * quantity;
      },
      0,
    );

    return Response.json(
      {
        paymentId,
        total,
        method,
        remainingTotal: Math.max(0, accountTotal - paidBefore - total),
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ödeme alınamadı." },
      { status: 500 },
    );
  }
}
