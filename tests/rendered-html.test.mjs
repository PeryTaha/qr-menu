import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps QR ordering direct and closes fully paid tables", async () => {
  const [ordersRoute, paymentsRoute, menuSystem] = await Promise.all([
    readProjectFile("app/api/orders/route.ts"),
    readProjectFile("app/api/payments/route.ts"),
    readProjectFile("app/menu-system.tsx"),
  ]);

  assert.doesNotMatch(ordersRoute, /isAuthorizedTableSession/);
  assert.match(ordersRoute, /INSERT INTO orders/);
  assert.match(paymentsRoute, /const autoClosed = remainingTotal === 0/);
  assert.match(paymentsRoute, /UPDATE orders SET status = 'closed'/);
  assert.doesNotMatch(menuSystem, /function TableAccessGate/);
  assert.match(menuSystem, /Okut · Seç · Sipariş ver/);
});

test("supports managed product photos and the supplied visual direction", async () => {
  const [imageRoute, menuRoute, menuSystem, styles, hosting, migration] =
    await Promise.all([
      readProjectFile("app/api/menu-images/route.ts"),
      readProjectFile("app/api/menu/route.ts"),
      readProjectFile("app/menu-system.tsx"),
      readProjectFile("app/globals.css"),
      readProjectFile(".openai/hosting.json"),
      readProjectFile("drizzle/0004_lovely_wolfsbane.sql"),
    ]);

  assert.match(imageRoute, /env\.MEDIA\.put/);
  assert.match(imageRoute, /5 \* 1024 \* 1024/);
  assert.match(menuRoute, /image_key AS imageKey/);
  assert.match(menuRoute, /\/api\/menu-images\?key=/);
  assert.match(menuSystem, /className="menu-item-photo"/);
  assert.match(menuSystem, /Fotoğraf seç/);
  assert.match(styles, /\.new-order-banner/);
  assert.match(styles, /\.kitchen-shell \{ grid-template-columns: 248px 1fr/);
  assert.match(hosting, /"r2": "MEDIA"/);
  assert.match(migration, /ADD `image_key` text/);
});
