import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";
import {
  PaymentError,
  type PaymentSelection,
  resolvePaymentAllocations,
} from "@/app/payments-core";
import { ensureAppSchema } from "@/db/runtime";

type RequestRow = {
  id: string;
  tableNo: number;
  amount: number;
  status: string;
  error: string;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
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
    };
    const tableNo = Number(payload.tableNo);
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
    const { total } = await resolvePaymentAllocations(tableNo, selections);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO pos_payment_requests (id, table_no, amount, selections, status)
       VALUES (?, ?, ?, ?, 'pending')`,
    )
      .bind(id, tableNo, total, JSON.stringify(selections))
      .run();

    return Response.json({ id, amount: total }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "POS isteği oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    await ensureAppSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ error: "İstek numarası gerekli." }, { status: 400 });
    }

    const row = await env.DB.prepare(
      `SELECT id, table_no AS tableNo, amount, status, error,
        payment_id AS paymentId, created_at AS createdAt, updated_at AS updatedAt
       FROM pos_payment_requests WHERE id = ?`,
    )
      .bind(id)
      .first<RequestRow>();
    if (!row) {
      return Response.json({ error: "POS isteği bulunamadı." }, { status: 404 });
    }

    return Response.json({ request: row });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "POS isteği alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    await ensureAppSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ error: "İstek numarası gerekli." }, { status: 400 });
    }

    const result = await env.DB.prepare(
      `UPDATE pos_payment_requests
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending', 'sent')`,
    )
      .bind(id)
      .run();
    if (!result.meta.changes) {
      return Response.json(
        { error: "İstek zaten tamamlanmış veya bulunamadı." },
        { status: 409 },
      );
    }

    return Response.json({ id, cancelled: true });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "İstek iptal edilemedi.",
      },
      { status: 500 },
    );
  }
}
