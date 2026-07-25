import { env } from "cloudflare:workers";

export const TABLE_SESSION_COOKIE = "masa_table_session";

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return "";
}

export async function isAuthorizedTableSession(
  request: Request,
  tableNo: number,
) {
  const cookieValue = readCookie(request, TABLE_SESSION_COOKIE);
  const separator = cookieValue.indexOf(".");
  if (separator < 1) return false;

  const cookieTable = Number(cookieValue.slice(0, separator));
  const token = cookieValue.slice(separator + 1);
  if (cookieTable !== tableNo || !token) return false;

  const session = await env.DB.prepare(
    `SELECT table_no
     FROM table_sessions
     WHERE table_no = ?
       AND token = ?
       AND active = 1
       AND expires_at > CURRENT_TIMESTAMP`,
  )
    .bind(tableNo, token)
    .first();
  return Boolean(session);
}

export function createTableSessionCookie(
  request: Request,
  tableNo: number,
  token: string,
) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${TABLE_SESSION_COOKIE}=${encodeURIComponent(
    `${tableNo}.${token}`,
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`;
}
