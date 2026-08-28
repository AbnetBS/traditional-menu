import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketItems, ticketPayments } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { and, gte, lte, inArray, eq, or } from "drizzle-orm";
import { readAdminSession, readStaffSession } from "@/lib/session";
import {
  computeRevenueIntelligence,
  resolveRange,
  addDays,
  DEFAULT_RI_THRESHOLDS,
} from "@/lib/revenue-intelligence";

export const dynamic = "force-dynamic";

/**
 * GET /api/revenue-intelligence — owner-facing decision intelligence.
 *
 * AUTH: admin→200, logged-in staff→403, none→401 (readAdminSession +
 * readStaffSession, the same pattern as Rush Mode / Order Health).
 *
 * QUERY: ?preset=today|yesterday|7d|30d  OR  ?preset=custom&from=YYYY-MM-DD&to=…
 *        &compare=1 is implicit (the previous equal-length period is always
 *        returned alongside).
 *
 * PERFORMANCE: server-side aggregation only. ONE bounded tickets scan
 * (createdAt within [prev-period-start − 7d, range-end + 1d], or a matching
 * closedAt) plus ONE batched item read for those tickets. The browser never
 * receives raw history; the pure engine aggregates in-process. No N+1, no new
 * realtime system, no second analytics store.
 */
export async function GET(request: Request) {
  const admin = await readAdminSession();
  if (!admin) {
    const staff = await readStaffSession();
    return NextResponse.json({ error: staff ? "Owner/admin only" : "Unauthorized" }, { status: staff ? 403 : 401 });
  }

  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get("preset") || "7d").toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = resolveRange(preset, from, to, new Date());

  try {
    // Superset window (Addis day boundaries + payment-after-creation), bounded.
    const start = new Date(`${addDays(range.prevFrom, -7)}T00:00:00Z`);
    const end = new Date(`${addDays(range.to, 1)}T00:00:00Z`);

    const rows = await db
      .select()
      .from(tickets)
      .where(
        or(
          and(gte(tickets.createdAt, start), lte(tickets.createdAt, end)),
          and(gte(tickets.closedAt, start), lte(tickets.closedAt, end))
        )
      );

    const rowIds = rows.map((t) => t.id);
    let items: Array<typeof ticketItems.$inferSelect> = [];
    let payments: Array<typeof ticketPayments.$inferSelect> = [];
    if (rowIds.length > 0) {
      [items, payments] = await Promise.all([
        db.select().from(ticketItems).where(and(inArray(ticketItems.ticketId, rowIds), eq(ticketItems.removed, false))),
        db.select().from(ticketPayments).where(inArray(ticketPayments.ticketId, rowIds)),
      ]);
    }

    const result = computeRevenueIntelligence(rows, items, range, DEFAULT_RI_THRESHOLDS, payments);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
