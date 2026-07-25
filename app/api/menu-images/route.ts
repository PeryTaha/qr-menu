import { env } from "cloudflare:workers";
import { isStaffRequest } from "@/app/staff-auth";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

const validKey = (value: string) =>
  value.startsWith("menu/") &&
  value.length <= 180 &&
  !value.includes("..") &&
  /^[a-zA-Z0-9/_\-.]+$/.test(value);

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!validKey(key)) {
    return Response.json({ error: "Geçersiz görsel." }, { status: 400 });
  }
  const object = await env.MEDIA.get(key);
  if (!object) {
    return Response.json({ error: "Görsel bulunamadı." }, { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  try {
    if (!(await isStaffRequest(request))) {
      return Response.json(
        { error: "Bu işlem yalnızca personel tarafından yapılabilir." },
        { status: 401 },
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Bir ürün fotoğrafı seçin." }, { status: 400 });
    }
    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return Response.json(
        { error: "JPG, PNG, WebP veya AVIF fotoğraf yükleyin." },
        { status: 415 },
      );
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "Fotoğraf en fazla 5 MB olabilir." },
        { status: 413 },
      );
    }
    const key = `menu/${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: "menu-editor" },
    });
    return Response.json(
      {
        key,
        url: `/api/menu-images?key=${encodeURIComponent(key)}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Fotoğraf yüklenemedi.",
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
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!validKey(key)) {
      return Response.json({ error: "Geçersiz görsel." }, { status: 400 });
    }
    await env.MEDIA.delete(key);
    return Response.json({ key, deleted: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Fotoğraf silinemedi.",
      },
      { status: 500 },
    );
  }
}
