import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("requires an active table session for customer orders", async () => {
  const [ordersRoute, sessionHelper, sessionsRoute] = await Promise.all([
    readProjectFile("app/api/orders/route.ts"),
    readProjectFile("app/table-session.ts"),
    readProjectFile("app/api/table-sessions/route.ts"),
  ]);

  assert.match(ordersRoute, /isAuthorizedTableSession\(request, tableNo\)/);
  assert.match(ordersRoute, /status:\s*403/);
  assert.match(sessionHelper, /HttpOnly;\s*SameSite=Lax/);
  assert.match(sessionHelper, /expires_at > CURRENT_TIMESTAMP/);
  assert.match(sessionsRoute, /action === "verify"/);
  assert.match(sessionsRoute, /failed_attempts/);
  assert.match(sessionsRoute, /2 minutes/);
});

test("invalidates the customer session when the bill is fully paid", async () => {
  const [paymentsRoute, menuSystem, migration] = await Promise.all([
    readProjectFile("app/api/payments/route.ts"),
    readProjectFile("app/menu-system.tsx"),
    readProjectFile("drizzle/0003_little_maginty.sql"),
  ]);

  assert.match(paymentsRoute, /const autoClosed = remainingTotal === 0/);
  assert.match(
    paymentsRoute,
    /UPDATE table_sessions SET active = 0 WHERE table_no = \?/,
  );
  assert.match(menuSystem, /function TableAccessGate/);
  assert.match(menuSystem, /6 haneli masa kodu/);
  assert.match(menuSystem, /Eski masa bağlantıları yeni oturumda geçersiz kalır/);
  assert.match(migration, /CREATE TABLE `table_sessions`/);
  assert.match(migration, /CREATE UNIQUE INDEX `table_sessions_token_unique`/);
});
