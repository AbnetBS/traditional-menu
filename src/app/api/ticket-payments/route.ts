import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketPayments } from "@/db/schema";
import { ensureTablesExist } from "@/db/migrate";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { readAdminSession, readStaffSession } from "@/lib/session";
import { persistImageRef } from "@/lib/image-store";
import { publish, CHANNELS } from "@/lib/realtime";
import {
  computeBalance,
  validatePayment,
  methodToPaymentStatus,
  isActivePayment,
} from "@/lib/split-billing";

export const dynamic = "force-dynamic";

/**
 * SPLIT BILLING settlement API — payment records against ONE operational ticket.
 *
 * AUTHORIZATION (server-side, never UI-only):
 *   • create / void  → cashier OR admin (waiter/kitchen/barista → 403, none → 401)
 *   • read (GET)     → any staff OR admin
 *
 * CONCURRENCY: creation runs in ONE transaction that locks the ticket row
 * (SELECT … FOR UPDATE), re-reads active payments, recomputes the remaining
 * balance from the CURRENT total, validates, inserts exactly once (unique
 * (ticket_id, idempotency_key)), and only marks the ticket `paid`/closed when
 * the recomputed remaining reaches 0. Retries with the same idempotency key
 * return the existing payment instead of creating a duplicate. The client can
 * never supply a trusted total/paid/remaining/paid-status.
 */

type Auth = { ok: true; who: string } | { ok: false; status: 401 | 403 };

async function authorizeSettlement(): Promise<Auth> {
  const admin = await readAdminSession();
  if (admin) return { ok: true, who: (admin as { name?: string }).name || "Admin" };
  const staff = await readStaffSession();
  if (!staff) return { ok: false, status: 401 };
  if (staff.role !== "cashier") return { ok: false, status: 403 };
  return { ok: true, who: staff.name || "Cashier" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = Number(searchParams.get("ticketId") || 0);
  if (!Number.isInteger(ticketId) || ticketId <= 0)
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });

  // Reads are available to any authenticated staff member.
  const admin = await readAdminSession();
  const staff = await readStaffSession();
  if (!admin && !staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  try {
    const [t] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    if (!t) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const payments = await db.select().from(ticketPayments).where(eq(ticketPayments.ticketId, ticketId));
    const balance = computeBalance(t.totalAmount ?? 0, payments);
    return NextResponse.json({ ticketId, total: balance.total, paid: balance.paid, remaining: balance.remaining, payments });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeSettlement();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Cashier/admin only" }, { status: auth.status });

  try {
    await ensureTablesExist();
  } catch {
    return NextResponse.json({ error: "Database unavailable — payment not recorded." }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const ticketId = Number(body?.ticketId ?? 0);
  const amount = Number(body?.amount);
  const method = String(body?.method ?? "");
  const reference = typeof body?.reference === "string" ? body.reference.slice(0, 100) : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 64) : null;
  const rawReceipt = typeof body?.receiptImage === "string" ? body.receiptImage : "";

  if (!Number.isInteger(ticketId) || ticketId <= 0) return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ error: "idempotencyKey required" }, { status: 400 });

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lock the ticket row so concurrent settlements serialize.
      const locked = await tx.execute(sql`SELECT id, status, total_amount FROM tickets WHERE id = ${ticketId} FOR UPDATE`);
      const t = (locked as unknown as { rows: Array<{ id: number; status: string; total_amount: string | number }> }).rows[0];
      if (!t) return { error: "Ticket not found", status: 404 } as const;

      const ticket = { id: t.id, status: t.status, totalAmount: Number(t.total_amount) || 0 };

      // 2. Idempotency: same key → return the already-recorded payment.
      const dup = await tx.select().from(ticketPayments).where(and(eq(ticketPayments.ticketId, ticketId), eq(ticketPayments.idempotencyKey, idempotencyKey)));
      const existingPayments = await tx.select().from(ticketPayments).where(eq(ticketPayments.ticketId, ticketId));
      if (dup.length > 0) {
        const bal = computeBalance(ticket.totalAmount, existingPayments);
        return { value: { ticketId, paymentId: dup[0].id, total: bal.total, paid: bal.paid, remaining: bal.remaining, method: dup[0].method, status: dup[0].status, fullyPaid: bal.remaining === 0, duplicate: true } } as const;
      }

      // 3-6. Server-side validation against the CURRENT balance.
      const err = validatePayment(ticket, existingPayments, amount, method);
      if (err) return { error: err, status: 400 } as const;

      // 7. Persist per-payment receipt proof (cash needs none).
      let receiptRef: string | null = null;
      if (rawReceipt) receiptRef = (await persistImageRef(rawReceipt, tx)) || null;

      // 8. Insert exactly once.
      const inserted = await tx.insert(ticketPayments).values({
        ticketId, amount, method, receiptImage: receiptRef, reference,
        status: "active", recordedBy: auth.who, idempotencyKey,
      }).returning();

      // 9. Recompute with the new payment.
      const after = [...existingPayments, inserted[0]];
      const bal = computeBalance(ticket.totalAmount, after);

      // 10/11. Close only at zero remaining; otherwise keep the ticket open.
      if (bal.remaining === 0) {
        await tx.update(tickets).set({
          status: "paid",
          paymentMethod: method,
          paymentStatus: methodToPaymentStatus(method),
          verifiedBy: auth.who,
          verifiedAt: new Date(),
          closedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(tickets.id, ticketId));
      } else {
        await tx.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));
      }

      return { value: { ticketId, paymentId: inserted[0].id, total: bal.total, paid: bal.paid, remaining: bal.remaining, method, status: "active", fullyPaid: bal.remaining === 0, duplicate: false } } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: (result as { status: number }).status });
    publish(CHANNELS.orders);
    return NextResponse.json(result.value, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Database unavailable — payment not recorded." }, { status: 503 });
  }
}

/** Void an active payment (cashier/admin). Cannot void once the ticket closed. */
export async function PATCH(request: Request) {
  const auth = await authorizeSettlement();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Cashier/admin only" }, { status: auth.status });
  try { await ensureTablesExist(); } catch { return NextResponse.json({ error: "Database unavailable" }, { status: 503 }); }

  let body: any; try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const id = Number(body?.id ?? 0);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const out = await db.transaction(async (tx) => {
      const [p] = await tx.select().from(ticketPayments).where(eq(ticketPayments.id, id));
      if (!p) return { error: "Payment not found", status: 404 } as const;
      if (p.status === "void") return { error: "Already voided", status: 400 } as const;
      const [t] = await tx.select().from(tickets).where(eq(tickets.id, p.ticketId));
      if (!t) return { error: "Ticket not found", status: 404 } as const;
      if (t.status === "paid" || t.status === "cancelled") return { error: "Ticket is closed — void outside V1.", status: 400 } as const;
      await tx.update(ticketPayments).set({ status: "void" }).where(eq(ticketPayments.id, id));
      const payments = await tx.select().from(ticketPayments).where(eq(ticketPayments.ticketId, p.ticketId));
      const bal = computeBalance(t.totalAmount ?? 0, payments);
      return { value: { ticketId: p.ticketId, total: bal.total, paid: bal.paid, remaining: bal.remaining } } as const;
    });
    if ("error" in out) return NextResponse.json({ error: out.error }, { status: (out as { status: number }).status });
    publish(CHANNELS.orders);
    return NextResponse.json(out.value);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
