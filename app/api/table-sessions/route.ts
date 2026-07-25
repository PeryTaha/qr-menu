import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";
import {
  createTableSessionCookie,
  isAuthorizedTableSession,
} from "@/app/table-session";
import { ensureAppSchema } from "@/db/runtime";

type SessionRow = {
  tableNo: number;
  token: string;
  accessCode: string;
  failedAttempts: number;
  lockedUntil: string | null;
  expiresAt: string;
  createdAt: string;
};

const validTableNo = (value: unknown) => {
  const tableNo = Number(value);
  return Number.isInteger(tableNo) && tableNo >= 1 && tableNo <= 999
    ? tableNo
    : null;
};

const createAccessCode = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
};

const createSessionValues = (tableNo: number) => ({
  tableNo,
  token: crypto.randomUUID(),
  accessCode: createAccessCode(),
});

const sqliteDate = (value: string | null) => {
  if (!value) return 0;
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalized).getTime();
};

async function createOrReplaceSession(tableNo: number) {
  const values = createSessionValues(tableNo);
  await env.DB.prepare(
    `INSERT INTO table_sessions
      (table_no, token, access_code, active, failed_attempts, locked_until, expires_at)
     VALUES (?, ?, ?, 1, 0, NULL, datetime('now', '+12 hours'))
     ON CONFLICT(table_no) DO UPDATE SET
       token = excluded.token,
       access_code = excluded.access_code,
       active = 1,
       failed_attempts = 0,
       locked_until = NULL,
       expires_at = excluded.expires_at,
       created_at = CURRENT_TIMESTAMP`,
  )
    .bind(tableNo, values.token, values.accessCode)
    .run();
  return values;
}

async function ensureSessionsForOpenTables() {
  const [openTablesResult, activeSessionsResult] = await Promise.all([
    env.DB.prepare(
      "SELECT DISTINCT table_no AS tableNo FROM orders WHERE status != 'closed'",
    ).all(),
    env.DB.prepare(
      `SELECT table_no AS tableNo
       FROM table_sessions
       WHERE active = 1 AND expires_at > CURRENT_TIMESTAMP`,
    ).all(),
  ]);
  const activeTables = new Set(
    activeSessionsResult.results.map((row) => Number(row.tableNo)),
  );
  const missingTables = openTablesResult.results
    .map((row) => Number(row.tableNo))
    .filter((tableNo) => !activeTables.has(tableNo));
  if (!missingTables.length) return;

  await env.DB.batch(
    missingTables.map((tableNo) => {
      const values = createSessionValues(tableNo);
      return env.DB.prepare(
        `INSERT INTO table_sessions
          (table_no, token, access_code, active, failed_attempts, locked_until, expires_at)
         VALUES (?, ?, ?, 1, 0, NULL, datetime('now', '+12 hours'))
         ON CONFLICT(table_no) DO UPDATE SET
           token = excluded.token,
           access_code = excluded.access_code,
           active = 1,
           failed_attempts = 0,
           locked_until = NULL,
           expires_at = excluded.expires_at,
           created_at = CURRENT_TIMESTAMP`,
      ).bind(tableNo, values.token, values.accessCode);
    }),
  );
}

export async function GET(request: Request) {
  try {
    await ensureAppSchema();
    const url = new URL(request.url);
    const tableNo = validTableNo(url.searchParams.get("table"));

    if (tableNo) {
      const active = await env.DB.prepare(
        `SELECT table_no
         FROM table_sessions
         WHERE table_no = ?
           AND active = 1
           AND expires_at > CURRENT_TIMESTAMP`,
      )
        .bind(tableNo)
        .first();
      return Response.json({
        active: Boolean(active),
        authorized: active
          ? await isAuthorizedTableSession(request, tableNo)
          : false,
      });
    }

    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Personel oturumu gerekli." },
        { status: 401 },
      );
    }

    await ensureSessionsForOpenTables();
    const result = await env.DB.prepare(
      `SELECT table_no AS tableNo, access_code AS accessCode,
        expires_at AS expiresAt, created_at AS createdAt
       FROM table_sessions
       WHERE active = 1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY table_no`,
    ).all();

    return Response.json({
      sessions: result.results.map((row) => ({
        tableNo: Number(row.tableNo),
        accessCode: String(row.accessCode),
        expiresAt: String(row.expiresAt),
        createdAt: String(row.createdAt),
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Masa oturumları alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureAppSchema();
    const payload = (await request.json()) as {
      action?: string;
      tableNo?: number;
      code?: string;
    };
    const tableNo = validTableNo(payload.tableNo);
    if (!tableNo) {
      return Response.json(
        { error: "Geçerli bir masa numarası gerekli." },
        { status: 400 },
      );
    }

    if (payload.action === "verify") {
      const code = String(payload.code ?? "").trim();
      if (!/^\d{6}$/.test(code)) {
        return Response.json(
          { error: "6 haneli masa kodunu girin." },
          { status: 400 },
        );
      }

      const session = await env.DB.prepare(
        `SELECT table_no AS tableNo, token, access_code AS accessCode,
          failed_attempts AS failedAttempts, locked_until AS lockedUntil,
          expires_at AS expiresAt, created_at AS createdAt
         FROM table_sessions
         WHERE table_no = ?
           AND active = 1
           AND expires_at > CURRENT_TIMESTAMP`,
      )
        .bind(tableNo)
        .first<SessionRow>();
      if (!session) {
        return Response.json(
          { error: "Bu masa şu anda siparişe kapalı.", active: false },
          { status: 410 },
        );
      }

      if (sqliteDate(session.lockedUntil) > Date.now()) {
        return Response.json(
          { error: "Çok fazla deneme yapıldı. 2 dakika sonra tekrar deneyin." },
          { status: 429 },
        );
      }

      if (code !== session.accessCode) {
        const nextAttempts =
          sqliteDate(session.lockedUntil) > 0 &&
          sqliteDate(session.lockedUntil) <= Date.now()
            ? 1
            : Number(session.failedAttempts) + 1;
        const shouldLock = nextAttempts >= 5;
        await env.DB.prepare(
          `UPDATE table_sessions
           SET failed_attempts = ?,
             locked_until = ${
               shouldLock ? "datetime('now', '+2 minutes')" : "NULL"
             }
           WHERE table_no = ?`,
        )
          .bind(shouldLock ? 0 : nextAttempts, tableNo)
          .run();
        return Response.json(
          {
            error: shouldLock
              ? "Çok fazla deneme yapıldı. 2 dakika sonra tekrar deneyin."
              : "Masa kodu yanlış.",
          },
          { status: shouldLock ? 429 : 401 },
        );
      }

      await env.DB.prepare(
        "UPDATE table_sessions SET failed_attempts = 0, locked_until = NULL WHERE table_no = ?",
      )
        .bind(tableNo)
        .run();
      return Response.json(
        { active: true, authorized: true },
        {
          headers: {
            "Set-Cookie": createTableSessionCookie(
              request,
              tableNo,
              session.token,
            ),
          },
        },
      );
    }

    if (payload.action !== "open" || !(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }

    const existing = await env.DB.prepare(
      `SELECT access_code AS accessCode
       FROM table_sessions
       WHERE table_no = ?
         AND active = 1
         AND expires_at > CURRENT_TIMESTAMP`,
    )
      .bind(tableNo)
      .first<{ accessCode: string }>();
    const session = existing ?? (await createOrReplaceSession(tableNo));
    return Response.json(
      {
        tableNo,
        accessCode: session.accessCode,
        active: true,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Masa oturumu açılamadı.",
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
    const payload = (await request.json()) as { tableNo?: number };
    const tableNo = validTableNo(payload.tableNo);
    if (!tableNo) {
      return Response.json(
        { error: "Geçerli bir masa numarası gerekli." },
        { status: 400 },
      );
    }

    const openOrders = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM orders WHERE table_no = ? AND status != 'closed'",
    )
      .bind(tableNo)
      .first<{ count: number }>();
    if (Number(openOrders?.count ?? 0) > 0) {
      return Response.json(
        { error: "Açık hesabı olan masa oturumu kapatılamaz." },
        { status: 409 },
      );
    }

    const result = await env.DB.prepare(
      "UPDATE table_sessions SET active = 0 WHERE table_no = ? AND active = 1",
    )
      .bind(tableNo)
      .run();
    return Response.json({ tableNo, closed: result.meta.changes > 0 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Masa oturumu kapatılamadı.",
      },
      { status: 500 },
    );
  }
}
