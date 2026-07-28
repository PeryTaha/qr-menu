import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";
import { ensureAppSchema } from "@/db/runtime";

type MenuPayload = {
  id?: number;
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  emoji?: string;
  imageKey?: string | null;
  imageFocalX?: number;
  imageFocalY?: number;
  popular?: boolean;
  available?: boolean;
  sortOrder?: number;
};

const clampFocal = (value: unknown) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 50;
};

function normalizeMenuPayload(payload: MenuPayload) {
  const name = String(payload.name ?? "").trim().slice(0, 80);
  const description = String(payload.description ?? "").trim().slice(0, 240);
  const category = String(payload.category ?? "").trim().slice(0, 50);
  const price = Math.round(Number(payload.price));
  const emoji = String(payload.emoji ?? "☕").trim().slice(0, 16) || "☕";
  const imageKey = payload.imageKey
    ? String(payload.imageKey).trim().slice(0, 180)
    : null;
  const imageFocalX = clampFocal(payload.imageFocalX ?? 50);
  const imageFocalY = clampFocal(payload.imageFocalY ?? 50);
  const sortOrder = Math.max(0, Math.round(Number(payload.sortOrder ?? 0)));

  if (!name || !category || !Number.isInteger(price) || price < 0) {
    return null;
  }

  return {
    name,
    description,
    category,
    price,
    emoji,
    imageKey,
    imageFocalX,
    imageFocalY,
    popular: Boolean(payload.popular),
    available: payload.available !== false,
    sortOrder,
  };
}

function mapMenuItem(row: Record<string, unknown>) {
  const imageKey = row.imageKey ? String(row.imageKey) : null;
  return {
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    popular: Boolean(row.popular),
    available: Boolean(row.available),
    sortOrder: Number(row.sortOrder),
    imageFocalX: Number(row.imageFocalX ?? 50),
    imageFocalY: Number(row.imageFocalY ?? 50),
    imageKey,
    imageUrl: imageKey
      ? `/api/menu-images?key=${encodeURIComponent(imageKey)}`
      : null,
  };
}

export async function GET(request: Request) {
  try {
    await ensureAppSchema();
    const url = new URL(request.url);
    const admin = url.searchParams.get("admin") === "1";
    if (admin && !(await isStaffRequest(request))) {
      return Response.json(
        { error: "Personel oturumu gerekli." },
        { status: 401 },
      );
    }

    const result = await env.DB.prepare(
      `SELECT id, name, description, category, price, emoji,
        image_key AS imageKey,
        image_focal_x AS imageFocalX, image_focal_y AS imageFocalY,
        popular, available, sort_order AS sortOrder
       FROM menu_items
       ${admin ? "" : "WHERE available = 1"}
       ORDER BY sort_order ASC, id ASC`,
    ).all();

    return Response.json({ items: result.results.map(mapMenuItem) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Menü alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    await ensureAppSchema();
    const payload = (await request.json()) as MenuPayload;
    const nextOrder = await env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM menu_items",
    ).first<{ nextOrder: number }>();
    const item = normalizeMenuPayload({
      ...payload,
      sortOrder: payload.sortOrder ?? Number(nextOrder?.nextOrder ?? 1),
    });
    if (!item) {
      return Response.json(
        { error: "Ürün adı, kategori ve geçerli fiyat gerekli." },
        { status: 400 },
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO menu_items
        (name, description, category, price, emoji, image_key, image_focal_x, image_focal_y, popular, available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        item.name,
        item.description,
        item.category,
        item.price,
        item.emoji,
        item.imageKey,
        item.imageFocalX,
        item.imageFocalY,
        item.popular ? 1 : 0,
        item.available ? 1 : 0,
        item.sortOrder,
      )
      .run();

    return Response.json(
      { id: Number(result.meta.last_row_id), ...item },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ürün eklenemedi." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    await ensureAppSchema();
    const payload = (await request.json()) as MenuPayload;
    const id = Number(payload.id);
    const item = normalizeMenuPayload(payload);
    if (!Number.isInteger(id) || id < 1 || !item) {
      return Response.json(
        { error: "Geçerli ürün bilgileri gerekli." },
        { status: 400 },
      );
    }

    const result = await env.DB.prepare(
      `UPDATE menu_items
       SET name = ?, description = ?, category = ?, price = ?, emoji = ?,
         image_key = ?, image_focal_x = ?, image_focal_y = ?,
         popular = ?, available = ?, sort_order = ?
       WHERE id = ?`,
    )
      .bind(
        item.name,
        item.description,
        item.category,
        item.price,
        item.emoji,
        item.imageKey,
        item.imageFocalX,
        item.imageFocalY,
        item.popular ? 1 : 0,
        item.available ? 1 : 0,
        item.sortOrder,
        id,
      )
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }

    return Response.json({ id, ...item });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ürün güncellenemedi." },
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
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return Response.json(
        { error: "Geçerli ürün numarası gerekli." },
        { status: 400 },
      );
    }

    const result = await env.DB.prepare("DELETE FROM menu_items WHERE id = ?")
      .bind(id)
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    return Response.json({ id, deleted: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ürün silinemedi." },
      { status: 500 },
    );
  }
}
