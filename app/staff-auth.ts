import { env } from "cloudflare:workers";

const COOKIE_NAME = "masa_staff";
const SESSION_SECONDS = 12 * 60 * 60;

export function safeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string) {
  const secret = env.STAFF_SESSION_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookie?.slice(COOKIE_NAME.length + 1) ?? "";
}

export function isValidStaffPin(pin: string) {
  return safeEqual(pin.trim(), env.STAFF_PIN ?? "");
}

export async function isStaffRequest(request: Request) {
  const [expiresText, signature] = readCookie(request).split(".");
  const expires = Number(expiresText);
  if (
    !Number.isInteger(expires) ||
    expires <= Math.floor(Date.now() / 1000) ||
    !signature
  ) {
    return false;
  }

  const expectedSignature = await sign(expiresText);
  return safeEqual(signature, expectedSignature);
}

export async function createStaffSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = await sign(String(expires));
  return `${COOKIE_NAME}=${expires}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearStaffSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
