/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DAILY BOARD PROMOTIONS — DATABASE ACCESS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Server-only. Loads live menu promos (announcements that point at a menu
 *  item with a promo price) so BOTH the customer menu and the ticket-pricing
 *  authority use exactly the same discounted price.
 *
 *  Pure math lives in src/lib/promotions.ts (unit-tested); this module only
 *  talks to Postgres.
 */

import { db } from "@/db";
import { announcements } from "@/db/schema";
import { asc } from "drizzle-orm";
import { isPromoLiveToday, type LivePromo } from "@/lib/promotions";

/**
 * All announcements whose promo (menu_item_id + sale_price) is live today.
 * Deterministic ordering: lowest priority number first, then oldest row;
 * the FIRST live promo for a menu item wins (a promo can never be silently
 * overwritten by a later row).
 */
export async function getLiveMenuPromos(): Promise<Map<number, LivePromo>> {
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(asc(announcements.priority), asc(announcements.id))
    .limit(200);

  const promos = new Map<number, LivePromo>();
  for (const a of rows) {
    const menuItemId = a.menuItemId ? Number(a.menuItemId) : 0;
    const salePrice = a.salePrice ? Number(a.salePrice) : 0;
    if (!menuItemId || !salePrice) continue;
    const live = isPromoLiveToday({ startDate: a.startDate, endDate: a.endDate });
    if (!live) continue;
    if (promos.has(menuItemId)) continue;
    promos.set(menuItemId, {
      menuItemId,
      salePrice,
      startDate: a.startDate,
      endDate: a.endDate,
    });
  }
  return promos;
}
