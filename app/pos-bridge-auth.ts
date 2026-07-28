import { env } from "cloudflare:workers";
import { safeEqual } from "@/app/staff-auth";

export function isBridgeRequest(request: Request) {
  const secret = env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, secret);
}
