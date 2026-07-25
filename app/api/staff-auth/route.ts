import {
  clearStaffSessionCookie,
  createStaffSessionCookie,
  isStaffRequest,
  isValidStaffPin,
} from "@/app/staff-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isStaffRequest(request) });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { pin?: string };
  if (!isValidStaffPin(String(payload.pin ?? ""))) {
    return Response.json(
      { error: "Personel şifresi yanlış." },
      { status: 401 },
    );
  }

  return Response.json(
    { authenticated: true },
    { headers: { "Set-Cookie": await createStaffSessionCookie() } },
  );
}

export async function DELETE() {
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearStaffSessionCookie() } },
  );
}
