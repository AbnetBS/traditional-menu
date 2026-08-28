/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REVENUE INTELLIGENCE — pure, unit-testable engine
 * ═══════════════════════════════════════════════════════════════════════════
 *  Decision-oriented interpretation of the SAME verified operational data the
 *  existing Reports tab uses — it EXTENDS, never duplicates, and never invents.
 *
 *  AUTHORITATIVE REVENUE PREDICATE (payment-verified):
 *    a ticket counts as revenue iff
 *      status !== 'cancelled'  AND  ( status === 'paid'  OR
 *      paymentStatus ∈ {paid_cash, paid_telebirr, paid_cbe, paid_card} )
 *    • cancelled            → never revenue
 *    • unpaid active        → never revenue
 *    • completed-but-unpaid → NOT revenue (it precedes payment verification)
 *
 *  This is REVENUE intelligence, not profit intelligence: there are NO cost /
 *  margin fields, so nothing here is ever labelled "profit"/"margin", and no
 *  customer identity, marketing attribution, or feast-package attribution is
 *  claimed (none exist in the schema).
 *
 *  TIMEZONE: timestamps are `timestamp` (no tz). We centralize day/hour
 *  bucketing in ONE place (`dayKey`/`hourOf`) using Africa/Addis_Ababa so a
 *  future migration touches one function. This assumes stored values represent
 *  correct instants (production PG/Node run UTC); the limitation is documented.
 */

export const REVENUE_TZ = "Africa/Addis_Ababa";

const PAID_STATUSES = new Set(["paid_cash", "paid_telebirr", "paid_cbe", "paid_card"]);

export interface RiTicketRow {
  id: number;
  tableId: number;
  tableName: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  totalAmount: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  closedAt: Date | string | null;
  verifiedAt: Date | string | null;
}
export interface RiItemRow {
  ticketId: number;
  menuItemId: number | null;
  name: string;
  category: string | null;
  price: number | null;
  quantity: number | null;
  removed: boolean | null;
  stationName: string | null;
}
export interface RiPaymentRow {
  ticketId: number;
  method: string;
  amount: number | null;
  status: string;
}

export interface ResolvedRange {
  from: string; // YYYY-MM-DD (Addis)
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
  /** true when the current period is still in progress (includes today). */
  partial: boolean;
  label: string;
}

/* ── date helpers (centralized Addis bucketing) ── */
const toDate = (v: Date | string | null): Date | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: REVENUE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-CA", { timeZone: REVENUE_TZ, hour: "numeric", hourCycle: "h23" });

export function dayKey(v: Date | string | null): string | null {
  const d = toDate(v);
  return d ? dayFmt.format(d) : null;
}
export function hourOf(v: Date | string | null): number | null {
  const d = toDate(v);
  if (!d) return null;
  const part = hourFmt.formatToParts(d).find((p) => p.type === "hour");
  const h = part ? Number(part.value) : NaN;
  return Number.isFinite(h) ? h : null;
}
/** payment / closing time — the authoritative revenue instant. */
export const paymentTime = (t: RiTicketRow) => t.closedAt ?? t.verifiedAt ?? t.updatedAt ?? t.createdAt;

const ymdToUtc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const utcToYmd = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(ymd: string, n: number): string {
  const d = ymdToUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToYmd(d);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((ymdToUtc(to).getTime() - ymdToUtc(from).getTime()) / 86400000) + 1;
}

export function resolveRange(
  preset: string | null,
  from: string | null,
  to: string | null,
  now: Date
): ResolvedRange {
  const today = dayKey(now) ?? utcToYmd(now);
  let f = today, t = today, label = "Today";
  if (preset === "yesterday") { f = addDays(today, -1); t = f; label = "Yesterday"; }
  else if (preset === "7d") { f = addDays(today, -6); t = today; label = "Last 7 days"; }
  else if (preset === "30d") { f = addDays(today, -29); t = today; label = "Last 30 days"; }
  else if (preset === "custom" && from && to && from <= to) { f = from; t = to; label = "Custom"; }

  // Bound arbitrary ranges so the endpoint stays cheap.
  const days = Math.min(Math.max(daysBetween(f, t), 1), 366);
  t = addDays(f, days - 1);
  const prevTo = addDays(f, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: f, to: t, prevFrom, prevTo, days, partial: t >= today, label };
}

/* ── revenue predicate ── */
export function isRevenueTicket(t: RiTicketRow): boolean {
  if (t.status === "cancelled") return false;
  return t.status === "paid" || (t.paymentStatus != null && PAID_STATUSES.has(t.paymentStatus));
}

export function percentChange(cur: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/* ── thresholds (configurable business defaults, not gospel) ── */
export interface RiThresholds {
  lowSellerMaxQty: number;   // an item at/below this qty in-range is a low seller
  minRangeDaysForLowSeller: number;
  minPatternSupport: number; // min orders a pair must co-occur in
  drinkAttachWarnFraction: number; // fraction of food-only orders that triggers a note
  eveningShareNote: number;  // evening+late revenue share that triggers a capacity note
}
export const DEFAULT_RI_THRESHOLDS: RiThresholds = {
  lowSellerMaxQty: 2,
  minRangeDaysForLowSeller: 7,
  minPatternSupport: 3,
  drinkAttachWarnFraction: 0.4,
  eveningShareNote: 0.5,
};

const DAYPARTS: Array<{ name: string; from: number; to: number }> = [
  { name: "Morning", from: 5, to: 11 },
  { name: "Afternoon", from: 12, to: 16 },
  { name: "Evening", from: 17, to: 21 },
  { name: "Late night", from: 22, to: 4 },
];
function daypartOf(hour: number): string {
  for (const p of DAYPARTS) {
    if (p.from <= p.to ? hour >= p.from && hour <= p.to : hour >= p.from || hour <= p.to) return p.name;
  }
  return "Late night";
}

export interface ItemStat { name: string; quantity: number; revenue: number; qtyPct: number; revPct: number; }
export interface CategoryStat { name: string; quantity: number; revenue: number; qtyPct: number; revPct: number; }
export interface PaymentStat { method: string; amount: number; count: number; pct: number; }
export interface HourStat { hour: number; revenue: number; orders: number; }
export interface PatternStat { a: string; b: string; count: number; }

export interface RevenueIntelligenceResult {
  range: ResolvedRange;
  headline: {
    revenue: number; orders: number; aov: number; totalItemQuantity: number; zeroValueOrders: number;
    prevRevenue: number; prevOrders: number; prevAov: number;
    revenueChange: number | null; ordersChange: number | null; aovChange: number | null;
  };
  trend: Array<{ day: string; revenue: number; orders: number }>;
  hourly: HourStat[];
  dayparts: Array<{ name: string; revenue: number; pct: number }>;
  items: ItemStat[];
  lowSellers: ItemStat[];
  categories: CategoryStat[];
  paymentMix: PaymentStat[];
  patterns: PatternStat[];
  attachment: { foodOrders: number; withDrink: number; withoutDrink: number; attachRate: number | null };
  opportunities: string[];
}

function headlineFor(list: RiTicketRow[]) {
  let revenue = 0, orders = 0, positive = 0, zero = 0, qty = 0;
  for (const t of list) {
    const amt = t.totalAmount || 0;
    orders++;
    revenue += amt;
    if (amt > 0) positive++;
    else zero++;
  }
  return { revenue, orders, zero, positive, aov: positive > 0 ? Math.round(revenue / positive) : 0, qty };
}

export function computeRevenueIntelligence(
  tickets: RiTicketRow[],
  itemRows: RiItemRow[],
  range: ResolvedRange,
  thresholds: RiThresholds = DEFAULT_RI_THRESHOLDS,
  paymentRows: RiPaymentRow[] = []
): RevenueIntelligenceResult {
  const qualifying = tickets.filter(isRevenueTicket);
  const inRange = (t: RiTicketRow, a: string, b: string) => {
    const d = dayKey(paymentTime(t));
    return d !== null && d >= a && d <= b;
  };
  const cur = qualifying.filter((t) => inRange(t, range.from, range.to));
  const prev = qualifying.filter((t) => inRange(t, range.prevFrom, range.prevTo));
  const curIds = new Set(cur.map((t) => t.id));

  const hc = headlineFor(cur);
  const hp = headlineFor(prev);

  /* items + categories from current-range, non-removed items (transaction price) */
  const itemAgg = new Map<string, { quantity: number; revenue: number; cat: string }>();
  const catAgg = new Map<string, { quantity: number; revenue: number }>();
  let totalQty = 0, totalItemRevenue = 0;
  const itemsByTicket = new Map<number, RiItemRow[]>();
  for (const it of itemRows) {
    if (!curIds.has(it.ticketId) || it.removed) continue;
    const qty = it.quantity ?? 1;
    const rev = (it.price ?? 0) * qty;
    const name = it.name || "Item";
    const cat = it.category || "general";
    const cur1 = itemAgg.get(name) ?? { quantity: 0, revenue: 0, cat };
    cur1.quantity += qty; cur1.revenue += rev;
    itemAgg.set(name, cur1);
    const c = catAgg.get(cat) ?? { quantity: 0, revenue: 0 };
    c.quantity += qty; c.revenue += rev;
    catAgg.set(cat, c);
    totalQty += qty; totalItemRevenue += rev;
    const arr = itemsByTicket.get(it.ticketId) ?? [];
    arr.push(it); itemsByTicket.set(it.ticketId, arr);
  }

  const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  const items: ItemStat[] = [...itemAgg.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue, qtyPct: pct(v.quantity, totalQty), revPct: pct(v.revenue, totalItemRevenue) }))
    .sort((a, b) => b.revenue - a.revenue);
  const categories: CategoryStat[] = [...catAgg.entries()]
    .map(([slug, v]) => ({ name: slug, quantity: v.quantity, revenue: v.revenue, qtyPct: pct(v.quantity, totalQty), revPct: pct(v.revenue, totalItemRevenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  /* payment mix — from settlement records when present (Split Billing), else
     the legacy single method. Revenue (headline) still sums ticket totals, so
     a split ticket counts once and its methods sum to the same total. */
  const paysByTicket = new Map<number, RiPaymentRow[]>();
  for (const p of paymentRows) {
    if (p.status === "void") continue;
    const arr = paysByTicket.get(p.ticketId) ?? [];
    arr.push(p); paysByTicket.set(p.ticketId, arr);
  }
  const payAgg = new Map<string, { amount: number; count: number }>();
  for (const t of cur) {
    const pays = paysByTicket.get(t.id) ?? [];
    if (pays.length > 0) {
      for (const p of pays) {
        const c = payAgg.get(p.method) ?? { amount: 0, count: 0 };
        c.amount += p.amount || 0; c.count++;
        payAgg.set(p.method, c);
      }
    } else {
      let m = t.paymentMethod || "";
      if (!m && t.paymentStatus) m = t.paymentStatus.replace("paid_", "");
      m = m || "cash";
      const c = payAgg.get(m) ?? { amount: 0, count: 0 };
      c.amount += t.totalAmount || 0; c.count++;
      payAgg.set(m, c);
    }
  }
  const paymentMix: PaymentStat[] = [...payAgg.entries()]
    .map(([method, v]) => ({ method, amount: v.amount, count: v.count, pct: pct(v.amount, hc.revenue) }))
    .sort((a, b) => b.amount - a.amount);

  /* trend by day + hourly (revenue uses payment time; orders also by payment day here) */
  const trendMap = new Map<string, { revenue: number; orders: number }>();
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) trendMap.set(d, { revenue: 0, orders: 0 });
  const hourlyMap = new Map<number, HourStat>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { hour: h, revenue: 0, orders: 0 });
  const daypartAgg = new Map<string, number>();
  for (const t of cur) {
    const d = dayKey(paymentTime(t));
    if (d && trendMap.has(d)) { const e = trendMap.get(d)!; e.revenue += t.totalAmount || 0; e.orders++; }
    const h = hourOf(paymentTime(t));
    if (h !== null) { const e = hourlyMap.get(h)!; e.revenue += t.totalAmount || 0; e.orders++; }
    if (h !== null) daypartAgg.set(daypartOf(h), (daypartAgg.get(daypartOf(h)) || 0) + (t.totalAmount || 0));
  }
  const trend = [...trendMap.entries()].map(([day, v]) => ({ day, ...v }));
  const hourly = [...hourlyMap.values()].filter((h) => h.orders > 0);
  const dayparts = [...daypartAgg.entries()].map(([name, revenue]) => ({ name, revenue, pct: pct(revenue, hc.revenue) })).sort((a, b) => b.revenue - a.revenue);

  /* order patterns (co-occurrence within the same paid order) + attachment */
  const pairCount = new Map<string, number>();
  let foodOrders = 0, withDrink = 0;
  for (const [tid, arr] of itemsByTicket) {
    void tid;
    const names = [...new Set(arr.map((i) => i.name))].sort();
    const hasFood = arr.some((i) => (i.stationName ?? "kitchen") === "kitchen");
    const hasDrink = arr.some((i) => (i.stationName ?? "kitchen") === "barista");
    if (hasFood) { foodOrders++; if (hasDrink) withDrink++; }
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]}|${names[j]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
  }
  const patterns: PatternStat[] = [...pairCount.entries()]
    .filter(([, c]) => c >= thresholds.minPatternSupport)
    .map(([k, count]) => { const [a, b] = k.split("|"); return { a, b, count }; })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const withoutDrink = foodOrders - withDrink;
  const attachRate = foodOrders > 0 ? Math.round((withDrink / foodOrders) * 1000) / 10 : null;

  /* low sellers */
  const lowSellers = range.days >= thresholds.minRangeDaysForLowSeller
    ? items.filter((i) => i.quantity <= thresholds.lowSellerMaxQty).sort((a, b) => a.quantity - b.quantity).slice(0, 8)
    : [];

  /* opportunities — deterministic, data-backed only */
  const opportunities: string[] = [];
  const revCh = percentChange(hc.revenue, hp.revenue);
  const ordCh = percentChange(hc.orders, hp.orders);
  const aovCh = percentChange(hc.aov, hp.aov);
  if (revCh !== null && revCh >= 5) opportunities.push(`Revenue is up ${revCh}% vs the previous ${range.days}-day period.`);
  if (revCh !== null && revCh <= -5) opportunities.push(`Revenue is down ${Math.abs(revCh)}% vs the previous period — review what changed.`);
  if (aovCh !== null && aovCh <= -5 && ordCh !== null && ordCh >= 0)
    opportunities.push(`Order volume is stable but average order value is down ${Math.abs(aovCh)}% — consider bundled recommendations.`);
  if (foodOrders > 0 && withoutDrink / foodOrders >= thresholds.drinkAttachWarnFraction)
    opportunities.push(`${Math.round((withoutDrink / foodOrders) * 100)}% of food orders include no drink — consider a drink recommendation with popular food items.`);
  const evening = (daypartAgg.get("Evening") || 0) + (daypartAgg.get("Late night") || 0);
  if (hc.revenue > 0 && evening / hc.revenue >= thresholds.eveningShareNote)
    opportunities.push(`Evening and late night generate ${pct(evening, hc.revenue)}% of revenue — protect kitchen and barista capacity in this window.`);
  if (lowSellers.length > 0)
    opportunities.push(`${lowSellers[0].name} has low sales in this period — consider repositioning, promoting, or reviewing availability.`);

  return {
    range,
    headline: {
      revenue: hc.revenue, orders: hc.orders, aov: hc.aov, totalItemQuantity: totalQty, zeroValueOrders: hc.zero,
      prevRevenue: hp.revenue, prevOrders: hp.orders, prevAov: hp.aov,
      revenueChange: revCh, ordersChange: ordCh, aovChange: aovCh,
    },
    trend, hourly, dayparts, items, lowSellers, categories, paymentMix, patterns,
    attachment: { foodOrders, withDrink, withoutDrink, attachRate },
    opportunities,
  };
}
