#!/usr/bin/env node
/**
 * Regression guard: Daily Board promotions safety.
 *  1. Promo fields validated server-side (linked item must exist in the menu,
 *     promo price positive int BELOW the item's normal price).
 *  2. Admin-only writes (auth precedes validation; public reads stay public).
 *  3. Public menu can opt in to promo prices (?promo=1) but admin/staff reads
 *     see the stored rows.
 *  4. Ticket pricing re-resolves prices server-side (client price never
 *     trusted) and includes live promos.
 *  5. Schema columns + migration are present.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const failures = [];
const pass = (name, v) => {
  console.log(`${v ? "✅" : "❌"} ${name}`);
  if (!v) failures.push(name);
};

const route = read("src/app/api/announcements/route.ts");
pass("announcements writes are admin-only", (route.match(/requireAdmin\(\)/g) || []).length >= 3);
pass("announcements validate linked menu item server-side", /Linked menu item must be a valid item id/.test(route) && /Linked menu item no longer exists/.test(route));
pass("announcements validate promo price (positive, below base)", /Promo price must be a positive whole number/.test(route) && /Promo price must be below the item's normal price/.test(route));
pass("announcements require item before promo price", /Pick a menu item before setting a promo price/.test(route));
pass("announcements enrich responses with item name/base price", /menuItemName/.test(route) && /menuItemBasePrice/.test(route));
pass("announcements public GET stays public", /export async function GET/.test(route) && !/requireAdmin\(\)/.test(route.split("export async function POST")[0]));

const menuRoute = read("src/app/api/menu/route.ts");
pass("menu promo overlay is opt-in (?promo=1)", /promo.*=== "1"/.test(menuRoute) || /=== "1"/.test(menuRoute));
pass("menu admin reads the stored rows (no overlay outside flag)", /withPromo \?/.test(menuRoute) || /withPromo\s*\?/.test(menuRoute));

const tickets = read("src/app/api/tickets/route.ts");
pass("tickets pricing authority applies live promos server-side", /getLiveMenuPromos/.test(tickets) && /applyPromosToItems/.test(tickets));
pass("tickets price comes from the server, never the client", /priceById/.test(tickets) && /it\.price = priceById/.test(tickets));
pass("tickets validates quantity bounds server-side", /qty < 1 \|\| qty > 100/.test(tickets) || /qty > 100/.test(tickets));

const schema = read("src/db/schema.ts");
pass("announcements table has menuItemId + salePrice columns", /menu_item_id/.test(schema) && /sale_price/.test(schema));
const migrate = read("src/db/migrate.ts");
pass("migration adds promo columns + bumps schema version", /menu_item_id: \{ type: "integer"/.test(migrate) && /sale_price: \{ type: "integer"/.test(migrate) && /daily-board-promos/.test(migrate));
pass("migration no longer hard-codes legacy venue names", !/Fana Cafe & Restaurant'/.test(migrate));

const tab = read("src/components/rms/DailyBoardTab.tsx");
pass("owner editor can link a menu item + set promo price", /menuItemId/.test(tab) && /salePrice/.test(tab) && /Promo price \(ETB/.test(tab));
pass("owner editor shows linked promo on board cards", /menuItemName \|\|/.test(tab) && /at \{a\.salePrice\} ETB/.test(tab));

const customer = read("src/components/rms/CustomerMenuApp.tsx");
pass("customer menu fetches promo-aware menu", /\/api\/menu\?promo=1/.test(customer));
pass("customer board shows an Order CTA for linked promos", /setDetailItem\(promoItem\)/.test(customer));

if (failures.length) {
  console.error(`\n❌ Daily Board promotions security guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Daily Board promotions security guard passed");
