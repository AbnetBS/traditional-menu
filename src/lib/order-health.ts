/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ORDER HEALTH — pure operational health engine
 * ═══════════════════════════════════════════════════════════════════════════
 *  Answers: "Which individual orders are progressing normally, approaching a
 *  delay, or already need intervention — and WHERE is the problem?"
 *
 *  Reads ONLY existing operational fields (tickets / ticket_items /
 *  service_calls). No second order system, no schema changes, no invented
 *  timestamps.
 *
 *  TIMING HONESTY:
 *    EXACT      waiting-for-waiter   = now − tickets.createdAt  (pending_waiter)
 *    EXACT      waiting-at-station   = now − ticket_items.createdAt (pending)
 *    APPROX     preparation          = item age from createdAt (no accepted_at/
 *                                      done_at exist; labelled as approximation)
 *    APPROX     ready-for-payment    = now − tickets.updatedAt ("since last
 *                                      update"; no ready_at exists)
 *    NOT AVAIL  confirmed_at / ready_at / accepted_at / done_at — future
 *               additive columns would make these exact (documented, not added).
 *
 *  Health states: WAITING | HEALTHY | AT_RISK | DELAYED.
 *  Thresholds are centralized + tunable here (later movable to admin settings);
 *  the per-menu "prep time" display string is NOT used as a timing rule.
 */

export type HealthState = "WAITING" | "HEALTHY" | "AT_RISK" | "DELAYED";
export type HealthWhere = "WAITER" | "KITCHEN" | "BARISTA" | "PAYMENT" | "SERVICE";

export interface OrderHealthThresholds {
  confirmMin: number;
  kitchenPrepMin: number;
  baristaPrepMin: number;
  readyMin: number;
  serviceMin: number;
  /** Fraction of the target at which an order becomes AT_RISK (~70%). */
  warnFraction: number;
}

export const DEFAULT_ORDER_HEALTH_THRESHOLDS: OrderHealthThresholds = {
  confirmMin: 5,
  kitchenPrepMin: 15,
  baristaPrepMin: 10,
  readyMin: 10,
  serviceMin: 5,
  warnFraction: 0.7,
};

/** Severity ordering for roll-up / sorting. */
export const SEVERITY: Record<HealthState, number> = {
  HEALTHY: 0,
  WAITING: 1,
  AT_RISK: 2,
  DELAYED: 3,
};

/**
 * Classify an age (in minutes, fractional) against a target.
 *   age >= target            → DELAYED
 *   age >= target*warn       → AT_RISK
 *   else                     → WAITING if this is an expected waiting step,
 *                             HEALTHY if it is actively progressing.
 * Boundary: exactly `target` is DELAYED; exactly `target*warn` is AT_RISK.
 */
export function classifyAge(
  ageMin: number | null,
  target: number,
  warnFraction: number,
  isWaitingStep: boolean
): HealthState {
  if (ageMin === null || !Number.isFinite(ageMin)) return isWaitingStep ? "WAITING" : "HEALTHY";
  if (ageMin >= target) return "DELAYED";
  if (ageMin >= target * warnFraction) return "AT_RISK";
  return isWaitingStep ? "WAITING" : "HEALTHY";
}

/* ── input row shapes (only fields that actually exist) ── */
export interface OhTicketRow {
  id: number;
  orderNumber: string | null;
  tableId: number;
  tableName: string;
  status: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
export interface OhItemRow {
  ticketId: number;
  name: string;
  quantity: number | null;
  stationName: string | null;
  stationStatus: string | null;
  createdAt: Date | string | null;
}
export interface OhCallRow {
  tableId: number;
  kind: string;
  status: string;
  createdAt: Date | string | null;
}

export interface ItemHealth {
  name: string;
  quantity: number;
  station: "kitchen" | "barista";
  stationStatus: string;
  state: HealthState;
  ageMin: number | null;
}
export interface TicketHealth {
  id: number;
  orderNumber: string | null;
  tableId: number;
  tableName: string;
  status: string;
  state: HealthState;
  where: HealthWhere | null;
  ageMin: number | null;
  items: ItemHealth[];
  serviceWarning: { kind: string; ageMin: number } | null;
}
export interface OrderHealthSnapshot {
  generatedAt: string;
  thresholds: OrderHealthThresholds;
  tickets: TicketHealth[];
  counts: { delayed: number; atRisk: number; healthy: number; serviceWarnings: number };
}

const toMs = (v: Date | string | null): number | null => {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};
/** Fractional minutes (do NOT round here — classification needs precision). */
const ageMinExact = (now: number, v: Date | string | null): number | null => {
  const t = toMs(v);
  return t === null ? null : Math.max(0, (now - t) / 60000);
};
const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

export function computeOrderHealth(
  tickets: OhTicketRow[],
  items: OhItemRow[],
  calls: OhCallRow[],
  now: Date,
  thresholds: OrderHealthThresholds = DEFAULT_ORDER_HEALTH_THRESHOLDS
): OrderHealthSnapshot {
  const nowMs = now.getTime();
  const th = thresholds;

  const itemsByTicket = new Map<number, OhItemRow[]>();
  for (const it of items) {
    const arr = itemsByTicket.get(it.ticketId) ?? [];
    arr.push(it);
    itemsByTicket.set(it.ticketId, arr);
  }
  // Outstanding (unacknowledged) service calls per table.
  const callsByTable = new Map<number, OhCallRow>();
  for (const c of calls) {
    if (c.status === "new") {
      const prev = callsByTable.get(c.tableId);
      if (!prev || (toMs(c.createdAt) ?? 0) < (toMs(prev.createdAt) ?? 0)) callsByTable.set(c.tableId, c);
    }
  }

  const results: TicketHealth[] = [];
  let delayed = 0,
    atRisk = 0,
    healthy = 0,
    serviceWarnings = 0;

  for (const t of tickets) {
    if (t.status === "paid" || t.status === "cancelled") continue; // defensive

    let worst: HealthState = "HEALTHY";
    let worstWhere: HealthWhere | null = null;
    let worstAge: number | null = null;
    const consider = (state: HealthState, where: HealthWhere, age: number | null) => {
      if (SEVERITY[state] > SEVERITY[worst]) {
        worst = state;
        worstWhere = where;
        worstAge = age;
      }
    };

    // Stage 1 — waiting for waiter (exact).
    if (t.status === "pending_waiter") {
      const a = ageMinExact(nowMs, t.createdAt);
      consider(classifyAge(a, th.confirmMin, th.warnFraction, true), "WAITER", a);
    }

    // Stage 4 — ready for payment (approx via updated_at).
    if (t.status === "ready_for_payment" || t.status === "completed") {
      const a = ageMinExact(nowMs, t.updatedAt);
      consider(classifyAge(a, th.readyMin, th.warnFraction, true), "PAYMENT", a);
    }

    // Stages 2+3 — per item/station.
    const itemHealth: ItemHealth[] = [];
    for (const it of itemsByTicket.get(t.id) ?? []) {
      const station: "kitchen" | "barista" = it.stationName === "barista" ? "barista" : "kitchen";
      const st = it.stationStatus ?? "pending";
      const target = station === "barista" ? th.baristaPrepMin : th.kitchenPrepMin;
      const age = ageMinExact(nowMs, it.createdAt);
      let state: HealthState;
      if (st === "done") state = "HEALTHY";
      else if (st === "accepted") state = classifyAge(age, target, th.warnFraction, false); // preparing (approx)
      else state = classifyAge(age, target, th.warnFraction, true); // pending (exact wait)
      itemHealth.push({
        name: it.name,
        quantity: it.quantity ?? 1,
        station,
        stationStatus: st,
        state,
        ageMin: round1(age),
      });
      if (st !== "done") consider(state, station === "barista" ? "BARISTA" : "KITCHEN", age);
    }

    // If nothing pushed a where (e.g. confirmed with all done), point at the
    // active workflow step for display.
    if (worstWhere === null) {
      if (t.status === "pending_waiter") worstWhere = "WAITER";
      else if (t.status === "ready_for_payment" || t.status === "completed") worstWhere = "PAYMENT";
      else worstWhere = itemHealth.some((i) => i.station === "kitchen" && i.stationStatus !== "done") ? "KITCHEN" : "BARISTA";
    }
    if (worstAge === null) worstAge = ageMinExact(nowMs, t.createdAt);

    // Service call warning (separate from food health).
    let serviceWarning: TicketHealth["serviceWarning"] = null;
    const call = callsByTable.get(t.tableId);
    if (call) {
      const ca = ageMinExact(nowMs, call.createdAt);
      if (ca !== null && ca >= th.serviceMin) {
        serviceWarning = { kind: call.kind, ageMin: Math.round(ca) };
        serviceWarnings++;
      }
    }

    // Compare via SEVERITY numbers (avoids TS over-narrowing the `worst` literal).
    if (SEVERITY[worst] >= SEVERITY.DELAYED) delayed++;
    else if (SEVERITY[worst] >= SEVERITY.AT_RISK) atRisk++;
    else healthy++;

    results.push({
      id: t.id,
      orderNumber: t.orderNumber,
      tableId: t.tableId,
      tableName: t.tableName,
      status: t.status,
      state: worst,
      where: worstWhere,
      ageMin: round1(worstAge),
      items: itemHealth,
      serviceWarning,
    });
  }

  // Severity first, then oldest first.
  results.sort((a, b) => SEVERITY[b.state] - SEVERITY[a.state] || (b.ageMin ?? 0) - (a.ageMin ?? 0));

  return { generatedAt: now.toISOString(), thresholds: th, tickets: results, counts: { delayed, atRisk, healthy, serviceWarnings } };
}
