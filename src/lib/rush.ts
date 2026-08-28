/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RUSH MODE — pure operational snapshot computation
 * ═══════════════════════════════════════════════════════════════════════════
 *  Answers ONE question: "Where should the manager intervene right now?"
 *
 *  This module is deliberately pure (rows + clock in, snapshot out) so it is
 *  unit-testable and the HTTP route stays thin. It uses ONLY fields that
 *  already exist in v1 — no new timestamp columns:
 *    tickets.createdAt / updatedAt / status / createdBy / confirmedBy
 *    ticket_items.createdAt / stationName / stationStatus
 *    service_calls.createdAt / status / ackBy
 *
 *  HONEST PRECISION NOTE: we do not store `confirmed_at` / `ready_at` /
 *  `accepted_at` yet. Where a transition time is needed we use the best
 *  existing proxy and say so:
 *    • "waiting for confirmation" = now − tickets.createdAt (exact).
 *    • "waiting for preparation"  = now − ticket_items.createdAt (exact per item).
 *    • "ready-for-payment age"    = now − tickets.updatedAt (APPROXIMATE — the
 *      transition bumps updated_at, but so can other edits; the UI labels it
 *      "since last update" rather than pretending it is an exact ready_at).
 */

export interface RushTicketRow {
  id: number;
  tableId: number;
  tableName: string;
  status: string;
  createdBy: string | null;
  confirmedBy: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
export interface RushItemRow {
  ticketId: number;
  stationName: string | null;
  stationStatus: string | null;
  createdAt: Date | string | null;
}
export interface RushCallRow {
  id: number;
  tableName: string;
  kind: string;
  status: string;
  ackBy: string | null;
  createdAt: Date | string | null;
}
export interface RushStaffRow {
  name: string;
  role: string;
}

export interface RushThresholds {
  /** pending_waiter older than this is flagged. */
  confirmationMin: number;
  /** a pending/accepted station item older than this is "delayed". */
  prepMin: number;
  /** ready_for_payment older than this (approx, updated_at) is flagged. */
  readyMin: number;
  /** an unacked service call older than this is flagged. */
  serviceMin: number;
}

/** Defaults are starting points for owner tuning — not invented gospel. */
export const DEFAULT_RUSH_THRESHOLDS: RushThresholds = {
  confirmationMin: 5,
  prepMin: 15,
  readyMin: 10,
  serviceMin: 5,
};

export interface AttentionItem {
  type: "confirmation" | "kitchen" | "barista" | "ready" | "service";
  table: string;
  detail: string;
  ageMin: number;
  /** true when the item has crossed its delay threshold. */
  delayed: boolean;
}

export interface StationStats {
  active: number;
  waiting: number;
  oldestWaitingMin: number | null;
  delayed: number;
}

export interface WaiterStats {
  name: string;
  activeOrders: number;
  pendingConfirmations: number;
  serviceCalls: number;
}

export interface RushSnapshot {
  generatedAt: string;
  thresholds: RushThresholds;
  overall: {
    activeTables: number;
    openOrders: number;
    waitingConfirmation: number;
    readyForPayment: number;
    activeServiceCalls: number;
  };
  kitchen: StationStats;
  barista: StationStats;
  waiters: WaiterStats[];
  attention: AttentionItem[];
}

const toMs = (v: Date | string | null): number | null => {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};
const ageMin = (now: number, v: Date | string | null): number | null => {
  const t = toMs(v);
  if (t === null) return null;
  return Math.max(0, Math.round((now - t) / 60000));
};

const isOpen = (t: RushTicketRow) => t.status !== "paid" && t.status !== "cancelled";

function stationStats(
  station: string,
  items: RushItemRow[],
  now: number,
  th: RushThresholds
): StationStats {
  const mine = items.filter((i) => (i.stationName ?? "kitchen") === station);
  const waiting = mine.filter((i) => i.stationStatus === "pending");
  const active = mine.filter((i) => i.stationStatus === "accepted");
  const ages = waiting.map((i) => ageMin(now, i.createdAt)).filter((a): a is number => a !== null);
  const oldest = ages.length ? Math.max(...ages) : null;
  const delayed = mine.filter((i) => {
    const a = ageMin(now, i.createdAt);
    return a !== null && a >= th.prepMin && i.stationStatus !== "done";
  }).length;
  return { active: active.length, waiting: waiting.length, oldestWaitingMin: oldest, delayed };
}

export function computeRush(
  tickets: RushTicketRow[],
  items: RushItemRow[],
  calls: RushCallRow[],
  staff: RushStaffRow[],
  now: Date,
  thresholds: RushThresholds = DEFAULT_RUSH_THRESHOLDS
): RushSnapshot {
  const nowMs = now.getTime();
  const open = tickets.filter(isOpen);

  const attention: AttentionItem[] = [];

  // Waiting for waiter confirmation (exact: now − created_at).
  let waitingConfirmation = 0;
  for (const t of open) {
    if (t.status === "pending_waiter") {
      waitingConfirmation++;
      const a = ageMin(nowMs, t.createdAt);
      if (a !== null)
        attention.push({ type: "confirmation", table: t.tableName, detail: "awaiting confirmation", ageMin: a, delayed: a >= thresholds.confirmationMin });
    }
  }

  // Ready for payment (approximate age via updated_at — labelled honestly).
  let readyForPayment = 0;
  for (const t of open) {
    if (t.status === "ready_for_payment" || t.status === "completed") {
      readyForPayment++;
      const a = ageMin(nowMs, t.updatedAt);
      if (a !== null && a >= thresholds.readyMin)
        attention.push({ type: "ready", table: t.tableName, detail: "ready, awaiting payment (since last update)", ageMin: a, delayed: true });
    }
  }

  // Station queues (exact per item: now − item.created_at).
  const kitchen = stationStats("kitchen", items, nowMs, thresholds);
  const barista = stationStats("barista", items, nowMs, thresholds);
  if (kitchen.oldestWaitingMin !== null && kitchen.oldestWaitingMin >= thresholds.prepMin)
    attention.push({ type: "kitchen", table: "Kitchen", detail: "oldest waiting item", ageMin: kitchen.oldestWaitingMin, delayed: true });
  if (barista.oldestWaitingMin !== null && barista.oldestWaitingMin >= thresholds.prepMin)
    attention.push({ type: "barista", table: "Bar", detail: "oldest waiting item", ageMin: barista.oldestWaitingMin, delayed: true });

  // Unhandled service calls (exact: now − created_at).
  const activeCalls = calls.filter((c) => c.status !== "done");
  for (const c of activeCalls) {
    const a = ageMin(nowMs, c.createdAt);
    if (a !== null && c.status === "new")
      attention.push({ type: "service", table: c.tableName, detail: `${c.kind} requested`, ageMin: a, delayed: a >= thresholds.serviceMin });
  }

  attention.sort((x, y) => y.ageMin - x.ageMin);

  // Waiter workload (counts only — no invented score).
  const waiterNames = new Set<string>(staff.filter((s) => s.role === "waiter").map((s) => s.name));
  for (const t of open) {
    const who = t.confirmedBy || (t.createdBy !== "Customer (QR)" ? t.createdBy : null);
    if (who) waiterNames.add(who);
  }
  const waiters: WaiterStats[] = [...waiterNames].sort().map((name) => {
    const activeOrders = open.filter(
      (t) => t.confirmedBy === name || (t.createdBy === name && t.status !== "pending_waiter")
    ).length;
    const pendingConfirmations = open.filter(
      (t) => t.createdBy === name && t.status === "pending_waiter"
    ).length;
    const serviceCalls = activeCalls.filter((c) => c.ackBy === name && c.status === "ack").length;
    return { name, activeOrders, pendingConfirmations, serviceCalls };
  });

  return {
    generatedAt: now.toISOString(),
    thresholds,
    overall: {
      activeTables: new Set(open.map((t) => t.tableId)).size,
      openOrders: open.length,
      waitingConfirmation,
      readyForPayment,
      activeServiceCalls: activeCalls.length,
    },
    kitchen,
    barista,
    waiters,
    attention: attention.slice(0, 8),
  };
}
