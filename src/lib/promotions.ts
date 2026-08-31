/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DAILY BOARD PROMOTIONS — PURE ENGINE LOGIC (no database access)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  A promotion links one LIVE "Daily Board" announcement to one EXISTING menu
 *  item and an optional promo price. While the announcement is live:
 *
 *    1. The customer menu (`/api/menu?promo=1`) shows the promo price.
 *    2. The server re-applies the promo price at order submission
 *       (`/api/tickets`), so the cart, ticket and bill always agree — a
 *       manipulated client can never pay less than the live promo price.
 *
 *  Everything here is restaurant-agnostic: titles, descriptions, prices and
 *  dates are owner-entered data; no business-specific content lives in code.
 *
 *  This module is intentionally pure so it can be unit-tested without a
 *  database (see scripts/verify-daily-board-logic.mjs).
 */

/** Date window used by an announcement/promo (empty = never expires). */
export interface PromoWindow {
  startDate?: string | null;
  endDate?: string | null;
}

/** One applied promo: which item, what price, and its live window. */
export interface LivePromo {
  menuItemId: number;
  salePrice: number;
  startDate?: string | null;
  endDate?: string | null;
}

/** Shape of an item that can receive promo price overrides. */
export type PromoableItem = {
  id: number;
  price?: number | null;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
};

function todayISO(): string {
  // Keep this consistent with src/lib/price.ts (UTC calendar day).
  return new Date().toISOString().slice(0, 10);
}

/**
 * Is the window live for `today`? Empty start/end means "no limit" — the
 * owner created the promo without dates, so it simply runs until edited.
 */
export function isPromoLiveToday(
  window: PromoWindow,
  today: string = todayISO()
): boolean {
  if (window.startDate && today < String(window.startDate)) return false;
  if (window.endDate && today > String(window.endDate)) return false;
  return true;
}

/**
 * Normalize a client-supplied menu item id for an announcement.
 * Returns a positive integer id, or null when unset. Throws nothing —
 * the route turns an invalid value into a 400 itself.
 */
export function normalizeMenuItemId(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "invalid";
  return n;
}

/**
 * Normalize a client-supplied promo price (ETB, whole birr).
 * Returns null when unset, or "invalid" when not a positive whole number.
 */
export function normalizePromoPrice(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "invalid";
  return n;
}

/**
 * Apply a live promo to one item by returning a NEW object with the promo
 * sale fields overlaid (the stored row is never mutated). When no promo is
 * active for the item, the item is returned unchanged.
 *
 * The sale fields feed the existing `effectivePrice()` helper
 * (src/lib/price.ts), which is the single price authority for menu display,
 * cart entry and ticket pricing.
 */
export function applyPromoOverrides<T extends PromoableItem>(
  item: T,
  promo: LivePromo | undefined
): T {
  if (!promo) return item;
  const base = Number(item.price || 0);
  const sale = Number(promo.salePrice || 0);
  // Never mark an item on sale at a price that is not actually cheaper.
  if (!sale || sale >= base) return item;
  return {
    ...item,
    salePrice: sale,
    saleStart: promo.startDate || item.saleStart || "",
    saleEnd: promo.endDate || item.saleEnd || "",
  };
}

/** Apply a Map of live promos to a list of items (clone-on-override). */
export function applyPromosToItems<T extends PromoableItem>(
  items: T[],
  promos: Map<number, LivePromo>
): T[] {
  return items.map((item) => applyPromoOverrides(item, promos.get(item.id)));
}
