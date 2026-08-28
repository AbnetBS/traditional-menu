import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceCalls, cafeTables } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { eq, desc } from "drizzle-orm";
import { publish, CHANNELS } from "@/lib/realtime";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireStaffOrAdmin } from "@/lib/session";

/**
 * SERVICE CALLS — "call the waiter without shouting".
 *
 *   POST   guest taps a request on the QR page  → row inserted, `orders`
 *          channel published so every waiter screen refreshes instantly.
 *   GET    waiter screen loads the open queue (new first, oldest first).
 *   PATCH  staff acknowledges ("on my way") or closes a call.
 *
 * Calls auto-expire after 3 hours so an unacknowledged request from a table
 * that already left can never sit on the queue forever.
 *
 * STORAGE: PostgreSQL is the source of truth. When the database is not
 * reachable (fresh preview before Coolify provisions Postgres) we fall back to
 * an in-process store so the guest → waiter flow is still demonstrable. The
 * fallback is transparent: the moment Postgres is up, every request uses it.
 */

interface CallRow {
  id: number;
  tableId: number;
  tableName: string;
  kind: string;
  note: string | null;
  status: string;
  createdAt: string | null;
  ackBy: string | null;
}

const ALLOWED_KINDS = new Set([
  "waiter",
  "bill",
  "injera",
  "coffee",
  "drinks",
  "celebration",
  "assistance",
]);

const EXPIRY_MS = 3 * 60 * 60 * 1000;

function isExpired(createdAt: string | Date | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() > EXPIRY_MS;
}

/* ── in-memory fallback (only used while the DB is unreachable) ── */
let memCalls: CallRow[] = [];
let memId = 0;

function memActive(): CallRow[] {
  memCalls = memCalls.filter((c) => c.status !== "done" && !isExpired(c.createdAt));
  return [...memCalls].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );
}

async function dbUp(): Promise<boolean> {
  try {
    await ensureTablesExist();
    await db.execute(/* sql */ `SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (await dbUp()) {
    try {
      const rows = await db
        .select()
        .from(serviceCalls)
        .orderBy(desc(serviceCalls.createdAt))
        .limit(200);
      const active = rows.filter((r) => r.status !== "done" && !isExpired(r.createdAt));
      active.reverse();
      return NextResponse.json(active);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }
  return NextResponse.json(memActive());
}

export async function POST(request: Request) {
  // A single guest tapping repeatedly must not flood the waiter queue.
  const rl = checkRateLimit(`service-call:${getClientIp(request)}`, 12, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — the waiter has already been notified." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let tableId = 0;
  let kind = "waiter";
  let note: string | null = null;
  try {
    const body = await request.json();
    tableId = Number(body?.tableId ?? 0);
    kind = String(body?.kind ?? "waiter");
    note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!Number.isInteger(tableId) || tableId <= 0) {
    return NextResponse.json({ error: "Missing table" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
  }

  // Resolve the table's display name so the waiter sees "Table 24", not an id.
  let tableName = `Table ${tableId}`;
  if (await dbUp()) {
    try {
      const t = await db.select().from(cafeTables).where(eq(cafeTables.id, tableId));
      if (t.length > 0) tableName = t[0].name;

      const inserted = await db
        .insert(serviceCalls)
        .values({ tableId, tableName, kind, note, status: "new" })
        .returning();
      publish(CHANNELS.orders);
      return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  // DB down → memory fallback.
  memId += 1;
  const row: CallRow = {
    id: memId,
    tableId,
    tableName,
    kind,
    note,
    status: "new",
    createdAt: new Date().toISOString(),
    ackBy: null,
  };
  memCalls.push(row);
  publish(CHANNELS.orders);
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const __auth = await requireStaffOrAdmin();
  if (!__auth.ok) return __auth.response;

  let id = 0;
  let status = "";
  try {
    const body = await request.json();
    id = Number(body?.id ?? 0);
    status = String(body?.status ?? "");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (status !== "new" && status !== "ack" && status !== "done") {
    return NextResponse.json({ error: "Bad status" }, { status: 400 });
  }

  const who = __auth.session.kind === "admin" ? "Admin" : "Staff";

  if (await dbUp()) {
    try {
      await db
        .update(serviceCalls)
        .set({ status, ackBy: status === "done" ? who : null })
        .where(eq(serviceCalls.id, id));
      publish(CHANNELS.orders);
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  const row = memCalls.find((c) => c.id === id);
  if (row) {
    row.status = status;
    row.ackBy = status === "done" ? who : null;
  }
  publish(CHANNELS.orders);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const __auth = await requireStaffOrAdmin();
  if (!__auth.ok) return __auth.response;
  try {
    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    if (ids.length === 0) return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    if (await dbUp()) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(serviceCalls).where(inArray(serviceCalls.id, ids));
    } else {
      memCalls = memCalls.filter((c) => !ids.includes(c.id));
    }
    publish(CHANNELS.orders);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
