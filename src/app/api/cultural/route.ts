import { NextResponse } from "next/server";
import { db } from "@/db";
import { culturalContent } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/session";
import { publish, CHANNELS } from "@/lib/realtime";
import { persistImageRef, deleteOrphanedCdnImages } from "@/lib/image-store";

/**
 * CULTURAL CONTENT MANAGER — owner-controlled cultural layer.
 *
 *   GET    public. Returns ACTIVE + PUBLISHED rows only (drafts and inactive
 *          are hidden). `?kind=x` returns one collection; otherwise all.
 *          `?scope=admin` (admin-only) returns EVERY row incl. drafts/inactive.
 *   POST   admin. Create. An inline `image` data-URL is persisted to
 *          `cdn_images` and stored as a `/api/images/{id}` reference.
 *   PUT    admin. Update by id (item / sortOrder / active / status / image).
 *   DELETE admin. Remove by id and clean up any orphaned image.
 *
 * Lifecycle: `status` = draft | published, combined with `active`:
 *   draft            → hidden from guests, editable, previewable
 *   published+active → visible to guests
 *   active=false     → inactive (hidden)
 *
 * When the DB is unreachable the public GET returns an empty shape so the
 * client falls back to bundled Totot defaults; admin writes return a real
 * non-2xx error (never a fake success).
 */

export type CulturalKind = "experience" | "package" | "story" | "special";
const KINDS: readonly string[] = ["experience", "package", "story", "special"];

interface Row {
  id: number;
  kind: string;
  data: string;
  imageUrl: string | null;
  status: string | null;
  sortOrder: number | null;
  active: boolean | null;
}

function isPublic(row: Row): boolean {
  return row.active !== false && row.status !== "draft";
}

function parseRow(row: Row) {
  let item: Record<string, unknown> = {};
  try {
    item = JSON.parse(row.data);
  } catch {
    item = {};
  }
  // The canonical image lives in the image_url column; expose it as `image`.
  if (row.imageUrl) item.image = row.imageUrl;
  return {
    ...item,
    id: row.id,
    active: row.active !== false,
    status: row.status === "draft" ? "draft" : "published",
  };
}

async function rowsFor(kind: string | undefined, includeAll: boolean): Promise<unknown[]> {
  const rows = (await db
    .select()
    .from(culturalContent)
    .orderBy(asc(culturalContent.sortOrder), asc(culturalContent.id))) as Row[];
  const filtered = rows.filter(
    (r) =>
      (kind ? r.kind === kind : KINDS.includes(r.kind)) && (includeAll || isPublic(r))
  );
  return filtered.map(parseRow);
}

/** Pull an image ref out of an item payload and persist a data-URL to cdn_images. */
async function persistItemImage(item: Record<string, unknown>): Promise<string> {
  const raw = (item.image ?? item.imageUrl) as string | undefined;
  const persisted = await persistImageRef(raw ?? "");
  return persisted;
}

function stripImageKeys(item: Record<string, unknown>): Record<string, unknown> {
  const { image, imageUrl, ...rest } = item;
  void image;
  void imageUrl;
  return rest;
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
  } catch {
    /* degrade below */
  }
  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const kind = kindParam && KINDS.includes(kindParam) ? kindParam : undefined;

  let includeAll = false;
  if (searchParams.get("scope") === "admin") {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    includeAll = true;
  }

  try {
    if (kind) return NextResponse.json(await rowsFor(kind, includeAll));
    const [experiences, packages, stories, specials] = await Promise.all([
      rowsFor("experience", includeAll),
      rowsFor("package", includeAll),
      rowsFor("story", includeAll),
      rowsFor("special", includeAll),
    ]);
    return NextResponse.json({ experiences, packages, stories, specials });
  } catch {
    return NextResponse.json(
      kind ? [] : { experiences: [], packages: [], stories: [], specials: [] }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable — not saved." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const kind = String(body?.kind ?? "");
    if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    const item: Record<string, unknown> =
      body?.item && typeof body.item === "object" ? body.item : {};

    const imageUrl = await persistItemImage(item).catch((e) => {
      throw new Error(`IMAGE:${e}`);
    });

    const inserted = await db
      .insert(culturalContent)
      .values({
        kind,
        data: JSON.stringify(stripImageKeys(item)),
        imageUrl: imageUrl || null,
        status: body?.status === "draft" ? "draft" : "published",
        sortOrder: Number(body?.sortOrder ?? 0),
        active: body?.active !== false,
      })
      .returning();
    publish(CHANNELS.orders);
    return NextResponse.json(parseRow(inserted[0] as Row), { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes("IMAGE:")) return NextResponse.json({ error: msg.slice(msg.indexOf(":") + 1) }, { status: 400 });
    return NextResponse.json({ error: "Database unavailable — not saved." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable — not saved." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const id = Number(body?.id ?? 0);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = (await db.select().from(culturalContent).where(eq(culturalContent.id, id))) as Row[];
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const oldImage = existing[0].imageUrl;

    const patch: Partial<typeof culturalContent.$inferInsert> = { updatedAt: new Date() };
    let newImageRef: string | null | undefined;

    if (body?.item && typeof body.item === "object") {
      const item: Record<string, unknown> = body.item;
      const persisted = await persistItemImage(item).catch((e) => {
        throw new Error(`IMAGE:${e}`);
      });
      patch.data = JSON.stringify(stripImageKeys(item));
      patch.imageUrl = persisted || null;
      newImageRef = persisted || null;
    }
    if (typeof body?.sortOrder === "number") patch.sortOrder = body.sortOrder;
    if (typeof body?.active === "boolean") patch.active = body.active;
    if (body?.status === "draft" || body?.status === "published") patch.status = body.status;

    const updated = await db
      .update(culturalContent)
      .set(patch)
      .where(eq(culturalContent.id, id))
      .returning();

    // If the image changed, the previous cdn blob may now be orphaned.
    if (newImageRef !== undefined && oldImage && oldImage !== newImageRef) {
      await deleteOrphanedCdnImages([oldImage]).catch(() => {});
    }
    publish(CHANNELS.orders);
    return NextResponse.json(parseRow(updated[0] as Row));
  } catch (error) {
    const msg = String(error);
    if (msg.includes("IMAGE:")) return NextResponse.json({ error: msg.slice(msg.indexOf(":") + 1) }, { status: 400 });
    return NextResponse.json({ error: "Database unavailable — not saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const id = Number(body?.id ?? 0);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = (await db.select().from(culturalContent).where(eq(culturalContent.id, id))) as Row[];
    await db.delete(culturalContent).where(eq(culturalContent.id, id));
    if (existing.length > 0 && existing[0].imageUrl) {
      await deleteOrphanedCdnImages([existing[0].imageUrl]).catch(() => {});
    }
    publish(CHANNELS.orders);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
