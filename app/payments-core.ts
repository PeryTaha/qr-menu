import { env } from "cloudflare:workers";

export type OrderItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export type PaymentSelection = {
  orderId?: string;
  itemId?: number;
  quantity?: number;
};

export type PaymentAllocation = {
  orderId: string;
  itemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function resolvePaymentAllocations(
  tableNo: number,
  selections: PaymentSelection[],
) {
  const orderResult = await env.DB.prepare(
    `SELECT id, items, total
     FROM orders
     WHERE table_no = ? AND status != 'closed'`,
  )
    .bind(tableNo)
    .all();
  if (!orderResult.results.length) {
    throw new PaymentError("Açık masa hesabı bulunamadı.", 404);
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
      alreadyPaid.set(key, (alreadyPaid.get(key) ?? 0) + allocation.quantity);
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
      throw new PaymentError("Geçersiz ürün veya adet seçimi.", 400);
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
      throw new PaymentError("Seçilen ürün açık masa hesabında bulunamadı.", 409);
    }

    const key = `${orderId}:${itemId}`;
    const remainingQuantity = item.quantity - (alreadyPaid.get(key) ?? 0);
    if (quantity > remainingQuantity) {
      throw new PaymentError(
        `${item.name} için ödenmemiş adet değişti. Hesabı yenileyin.`,
        409,
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
    throw new PaymentError("Ödeme tutarı sıfır olamaz.", 400);
  }

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

  return { allocations, total, accountTotal, paidBefore };
}

export async function insertPayment(
  tableNo: number,
  allocations: PaymentAllocation[],
  total: number,
  accountTotal: number,
  paidBefore: number,
  method: "cash" | "card",
) {
  const remainingTotal = Math.max(0, accountTotal - paidBefore - total);
  const autoClosed = remainingTotal === 0;
  const paymentId = crypto.randomUUID();
  const insert = env.DB.prepare(
    `INSERT INTO payments (id, table_no, allocations, total, method)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(paymentId, tableNo, JSON.stringify(allocations), total, method);

  if (autoClosed) {
    await env.DB.batch([
      insert,
      env.DB.prepare(
        "UPDATE orders SET status = 'closed' WHERE table_no = ? AND status != 'closed'",
      ).bind(tableNo),
      env.DB.prepare(
        "UPDATE table_sessions SET active = 0 WHERE table_no = ?",
      ).bind(tableNo),
    ]);
  } else {
    await insert.run();
  }

  return { paymentId, remainingTotal, autoClosed };
}
