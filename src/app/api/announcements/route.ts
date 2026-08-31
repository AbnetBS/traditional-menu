import { NextResponse } from "next/server";
import { db } from "@/db";
import { announcements, menuItems } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { eq, asc, inArray } from "drizzle-orm";
import { PUBLIC_CACHE_CONTROL } from "@/lib/cache";
import { fixSiteText } from "@/lib/brand";
import { deleteOrphanedCdnImages, persistImageRef } from "@/lib/image-store";
import { requireAdmin } from "@/lib/session";
import { normalizeMenuItemId, normalizePromoPrice } from "@/lib/promotions";

function isActiveToday(a: { startDate?: string | null; endDate?: string | null }): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (a.startDate && today < String(a.startDate)) return false;
  if (a.endDate && today > String(a.endDate)) return false;
  return true;
}

/**
 * Validate the promo fields of an announcement body.
 * Returns { ok, menuItemId, salePrice, error? }. `menuItemId`/`salePrice`
 * are null when the owner left the promo fields empty.
 */
async function parsePromoFields(
  body: Record<string, unknown>
): Promise<{ ok: true; menuItemId: number | null; salePrice: number | null } | { ok: false; error: string }> {
  const rawId = body.menuItemId;
  const rawPrice = body.salePrice;

  const menuItemId = normalizeMenuItemId(rawId);
  if (menuItemId === "invalid") {
    return { ok: false, error: "Linked menu item must be a valid item id" };
  }
  const salePrice = normalizePromoPrice(rawPrice);
  if (salePrice === "invalid") {
    return { ok: false, error: "Promo price must be a positive whole number (ETB)" };
  }
  if (!menuItemId && salePrice) {
    return { ok: false, error: "Pick a menu item before setting a promo price" };
  }

  if (menuItemId) {
    const row = await db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).limit(1);
    if (row.length === 0) {
      return { ok: false, error: "Linked menu item no longer exists" };
    }
    if (salePrice && Number(salePrice) >= Number(row[0].price || 0)) {
      return { ok: false, error: "Promo price must be below the item's normal price" };
    }
  }

  return { ok: true, menuItemId, salePrice };
}

/** Attach menu display info (name + base price) to each announcement. */
async function enrichWithMenuItem<T extends { menuItemId?: number | null }>(list: T[]) {
  const ids = [...new Set(list.map((a) => a.menuItemId).filter((id): id is number => Boolean(id)))];
  const byId = new Map<number, { name: string; price: number }>();
  if (ids.length > 0) {
    const rows = await db.select().from(menuItems).where(inArray(menuItems.id, ids));
    for (const r of rows) byId.set(r.id, { name: r.name, price: r.price });
  }
  return list.map((a) => {
    const meta = a.menuItemId ? byId.get(Number(a.menuItemId)) : undefined;
    return {
      ...a,
      menuItemName: meta?.name ?? null,
      menuItemBasePrice: meta?.price ?? null,
    };
  });
}

export async function GET(request: Request) {
  await ensureTablesExist();
  try {
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("active") === "1";
    // Safety cap on the owner-managed board (200 is far beyond realistic
    // usage; a real board is a handful of active items).
    let list = await db.select().from(announcements).orderBy(asc(announcements.priority), asc(announcements.id)).limit(200);
    if (onlyActive) list = list.filter(isActiveToday);
    // Brand/address guard — legacy rows are always served with the configured
    // business name/address (see src/lib/brand.ts).
    list = list.map((a) => ({
      ...a,
      title: fixSiteText(a.title),
      description: fixSiteText(a.description),
    }));
    const enriched = await enrichWithMenuItem(list);
    return NextResponse.json(enriched, { status: 200, headers: { "Cache-Control": PUBLIC_CACHE_CONTROL } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const __auth = await requireAdmin();
  if (!__auth.ok) return __auth.response;
  await ensureTablesExist();
  try {
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "Title required" }, { status: 400 });

    const promo = await parsePromoFields(body);
    if (!promo.ok) return NextResponse.json({ error: promo.error }, { status: 400 });

    const created = await db
      .insert(announcements)
      .values({
        title: body.title,
        description: body.description || "",
        imageUrl: await persistImageRef(body.imageUrl || ""),
        startDate: body.startDate || "",
        endDate: body.endDate || "",
        priority: Number(body.priority || 0),
        menuItemId: promo.menuItemId,
        salePrice: promo.salePrice,
      })
      .returning();
    const [enriched] = await enrichWithMenuItem(created);
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const __auth = await requireAdmin();
  if (!__auth.ok) return __auth.response;
  await ensureTablesExist();
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const existing = await db.select().from(announcements).where(eq(announcements.id, body.id));
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const promo = await parsePromoFields(body);
    if (!promo.ok) return NextResponse.json({ error: promo.error }, { status: 400 });

    const updated = await db
      .update(announcements)
      .set({
        title: body.title,
        description: body.description,
        imageUrl: await persistImageRef(body.imageUrl ?? ""),
        startDate: body.startDate,
        endDate: body.endDate,
        priority: Number(body.priority || 0),
        menuItemId: promo.menuItemId,
        salePrice: promo.salePrice,
      })
      .where(eq(announcements.id, body.id))
      .returning();
    // Drop the old cdn_images row if the image was replaced/removed.
    await deleteOrphanedCdnImages([existing[0].imageUrl]);
    const [enriched] = await enrichWithMenuItem(updated);
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const __auth = await requireAdmin();
  if (!__auth.ok) return __auth.response;
  await ensureTablesExist();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const existing = await db.select().from(announcements).where(eq(announcements.id, Number(id)));
    await db.delete(announcements).where(eq(announcements.id, Number(id)));
    if (existing.length > 0) await deleteOrphanedCdnImages([existing[0].imageUrl]);
    return NextResponse.json({ success: true, id: Number(id) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
