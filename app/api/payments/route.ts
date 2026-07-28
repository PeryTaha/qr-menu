import { isStaffRequest } from "@/app/staff-auth";
import {
  PaymentError,
  type PaymentSelection,
  insertPayment,
  resolvePaymentAllocations,
} from "@/app/payments-core";
import { ensureAppSchema } from "@/db/runtime";

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
    const { allocations, total, accountTotal, paidBefore } =
      await resolvePaymentAllocations(tableNo, selections);
    const { paymentId, remainingTotal, autoClosed } = await insertPayment(
      tableNo,
      allocations,
      total,
      accountTotal,
      paidBefore,
      method,
    );

    return Response.json(
      { paymentId, total, method, remainingTotal, autoClosed },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Ödeme alınamadı." },
      { status: 500 },
    );
  }
}
