import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketItems, serviceCalls } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { readAdminSession, readStaffSession } from "@/lib/session";
import { computeOrderHealth, DEFAULT_ORDER_HEALTH_THRESHOLDS } from "@/lib/order-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/order-health — per-order operational health (owner/admin only).
 *
 * AUTHORIZATION mirrors Rush Mode: admin→200, logged-in staff→403, none→401
 * (readAdminSession + readStaffSession; NOT requireStaffOrAdmin).
 *
 * Read-only and server-aggregated over OPEN tickets only (status NOT IN
 * paid/cancelled — an indexed partial scan). Exactly THREE bounded queries
 * (open tickets, their non-removed items, outstanding service calls) — no N+1,
 * no per-ticket requests, no historical data, no customer-sensitive fields.
 */
export async function GET() {
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

  try {
    const open = await db
      .select({
        id: tickets.id,
        orderNumber: tickets.orderNumber,
        tableId: tickets.tableId,
        tableName: tickets.tableName,
        status: tickets.status,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(notInArray(tickets.status, ["paid", "cancelled"]));

    let items: Array<{ ticketId: number; name: string; quantity: number | null; stationName: string | null; stationStatus: string | null; createdAt: Date | null }> = [];
    if (open.length > 0) {
      items = await db
        .select({
          ticketId: ticketItems.ticketId,
          name: ticketItems.name,
          quantity: ticketItems.quantity,
          stationName: ticketItems.stationName,
          stationStatus: ticketItems.stationStatus,
          createdAt: ticketItems.createdAt,
        })
        .from(ticketItems)
        .where(and(inArray(ticketItems.ticketId, open.map((t) => t.id)), eq(ticketItems.removed, false)));
    }

    const calls = await db
      .select({ tableId: serviceCalls.tableId, kind: serviceCalls.kind, status: serviceCalls.status, createdAt: serviceCalls.createdAt })
      .from(serviceCalls)
      .where(eq(serviceCalls.status, "new"));

    const snapshot = computeOrderHealth(open, items, calls, new Date(), DEFAULT_ORDER_HEALTH_THRESHOLDS);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
