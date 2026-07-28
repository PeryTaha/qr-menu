import { env } from "cloudflare:workers";
import { isBridgeRequest } from "@/app/pos-bridge-auth";
import {
  PaymentError,
  type PaymentSelection,
  insertPayment,
  resolvePaymentAllocations,
} from "@/app/payments-core";
import { ensureAppSchema } from "@/db/runtime";

export async function GET(request: Request) {
  try {
    if (!isBridgeRequest(request)) {
      return Response.json({ error: "Yetkisiz köprü isteği." }, { status: 401 });
    }
    await ensureAppSchema();

    const next = await env.DB.prepare(
      `SELECT id, table_no AS tableNo, amount
       FROM pos_payment_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
    ).first<{ id: string; tableNo: number; amount: number }>();
    if (!next) {
      return Response.json({ request: null });
    }

    const claim = await env.DB.prepare(
      `UPDATE pos_payment_requests
       SET status = 'sent', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(next.id)
      .run();
    if (!claim.meta.changes) {
      return Response.json({ request: null });
    }

    return Response.json({
      request: { id: next.id, tableNo: next.tableNo, amount: next.amount },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Bekleyen istek alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isBridgeRequest(request)) {
      return Response.json({ error: "Yetkisiz köprü isteği." }, { status: 401 });
    }
    await ensureAppSchema();
    const payload = (await request.json()) as {
      id?: string;
      approved?: boolean;
      message?: string;
    };
    const id = String(payload.id ?? "");
    if (!id) {
      return Response.json({ error: "İstek numarası gerekli." }, { status: 400 });
    }

    const row = await env.DB.prepare(
      `SELECT id, table_no AS tableNo, selections
       FROM pos_payment_requests
       WHERE id = ? AND status = 'sent'`,
    )
      .bind(id)
      .first<{ id: string; tableNo: number; selections: string }>();
    if (!row) {
      return Response.json(
        { error: "İstek bulunamadı veya zaten sonuçlanmış." },
        { status: 409 },
      );
    }

    if (!payload.approved) {
      await env.DB.prepare(
        `UPDATE pos_payment_requests
         SET status = 'declined', error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
        .bind(String(payload.message ?? "POS işlemi reddedildi."), id)
        .run();
      return Response.json({ id, status: "declined" });
    }

    const selections = JSON.parse(row.selections) as PaymentSelection[];
    const { allocations, total, accountTotal, paidBefore } =
      await resolvePaymentAllocations(row.tableNo, selections);
    const { paymentId, remainingTotal, autoClosed } = await insertPayment(
      row.tableNo,
      allocations,
      total,
      accountTotal,
      paidBefore,
      "card",
    );

    await env.DB.prepare(
      `UPDATE pos_payment_requests
       SET status = 'approved', payment_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(paymentId, id)
      .run();

    return Response.json({
      id,
      status: "approved",
      paymentId,
      remainingTotal,
      autoClosed,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Sonuç işlenemedi." },
      { status: 500 },
    );
  }
}
