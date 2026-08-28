import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketItems, serviceCalls, staffUsers } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { readAdminSession, readStaffSession } from "@/lib/session";
import { computeRush, DEFAULT_RUSH_THRESHOLDS } from "@/lib/rush";

export const dynamic = "force-dynamic";

/**
 * GET /api/rush — the Rush Mode operational snapshot.
 *
 * AUTHORIZATION (owner/admin only):
 *   • admin session            → 200
 *   • any staff session        → 403  (waiter / cashier / kitchen / barista)
 *   • no session               → 401
 *
 * The snapshot is aggregated SERVER-SIDE over the small set of OPEN tickets
 * (status NOT IN paid/cancelled, an indexed partial scan) and returned compact.
 * The browser never receives the full order history. No new columns are read
 * or written — v1 uses only existing timestamps (see src/lib/rush.ts for the
 * honest-precision notes).
 */
export async function GET() {
  const admin = await readAdminSession();
  if (!admin) {
    const staff = await readStaffSession();
    // A logged-in staff member who is NOT the owner: forbidden, not missing.
    return NextResponse.json({ error: staff ? "Owner/admin only" : "Unauthorized" }, { status: staff ? 403 : 401 });
  }

  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    // Open tickets only (bounded, indexed).
    const open = await db
      .select({
        id: tickets.id,
        tableId: tickets.tableId,
        tableName: tickets.tableName,
        status: tickets.status,
        createdBy: tickets.createdBy,
        confirmedBy: tickets.confirmedBy,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(notInArray(tickets.status, ["paid", "cancelled"]));

    let items: Array<{ ticketId: number; stationName: string | null; stationStatus: string | null; createdAt: Date | null }> = [];
    if (open.length > 0) {
      items = await db
        .select({
          ticketId: ticketItems.ticketId,
          stationName: ticketItems.stationName,
          stationStatus: ticketItems.stationStatus,
          createdAt: ticketItems.createdAt,
        })
        .from(ticketItems)
        .where(
          and(
            inArray(ticketItems.ticketId, open.map((t) => t.id)),
            eq(ticketItems.removed, false),
            inArray(ticketItems.stationStatus, ["pending", "accepted"])
          )
        );
    }

    const calls = await db
      .select({
        id: serviceCalls.id,
        tableName: serviceCalls.tableName,
        kind: serviceCalls.kind,
        status: serviceCalls.status,
        ackBy: serviceCalls.ackBy,
        createdAt: serviceCalls.createdAt,
      })
      .from(serviceCalls)
      .where(notInArray(serviceCalls.status, ["done"]));

    const staff = await db.select({ name: staffUsers.name, role: staffUsers.role }).from(staffUsers);

    const snapshot = computeRush(open, items, calls, staff, new Date(), DEFAULT_RUSH_THRESHOLDS);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
