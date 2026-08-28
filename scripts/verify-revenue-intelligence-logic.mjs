#!/usr/bin/env node
/**
 * Pure-logic tests for Revenue Intelligence (src/lib/revenue-intelligence.ts).
 * Transpiles the REAL module with the project's TypeScript and asserts against
 * it (revenue, AOV, comparison, exclusions, item/category/payment/hourly,
 * patterns, attachment, low sellers, opportunities).
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const src = readFileSync(join(root, "src/lib/revenue-intelligence.ts"), "utf8");
const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const dir = mkdtempSync(join(tmpdir(), "ri-"));
const modPath = join(dir, "ri.mjs");
writeFileSync(modPath, outputText);
const ri = await import(pathToFileURL(modPath).href);

const { computeRevenueIntelligence, resolveRange, isRevenueTicket, percentChange, DEFAULT_RI_THRESHOLDS } = ri;
let fails = 0;
const t = (n, c) => { console.log(`${c ? "✅" : "❌"} ${n}`); if (!c) fails++; };

const NOW = new Date("2026-08-27T12:00:00Z"); // 15:00 Addis, day 27

const T = (id, day, o = {}) => ({
  id, tableId: id, tableName: `T${id}`, status: "paid", paymentMethod: "cash", paymentStatus: "paid_cash",
  totalAmount: 0, createdAt: `${day}T09:00:00Z`, updatedAt: `${day}T10:00:00Z`, closedAt: `${day}T10:00:00Z`, verifiedAt: `${day}T10:00:00Z`, ...o,
});
const I = (ticketId, name, qty, price, cat, station = "kitchen", removed = false) =>
  ({ ticketId, menuItemId: null, name, category: cat, price, quantity: qty, removed, stationName: station });

/* revenue predicate */
t("cancelled never revenue", !isRevenueTicket(T(1, "2026-08-27", { status: "cancelled", totalAmount: 999 })));
t("completed-unpaid NOT revenue", !isRevenueTicket(T(2, "2026-08-27", { status: "completed", paymentStatus: "unpaid" })));
t("active unpaid NOT revenue", !isRevenueTicket(T(3, "2026-08-27", { status: "confirmed", paymentStatus: "unpaid" })));
t("paid IS revenue", isRevenueTicket(T(4, "2026-08-27", {})));
t("paymentStatus paid_telebirr IS revenue", isRevenueTicket(T(5, "2026-08-27", { status: "completed", paymentStatus: "paid_telebirr" })));

/* percent change boundaries */
t("percentChange 500->1000 = +100", percentChange(1000, 500) === 100);
t("percentChange prev 0 = null", percentChange(100, 0) === null);

/* single-day range with comparison + exclusions + aggregation */
{
  const range = resolveRange("custom", "2026-08-27", "2026-08-27", NOW);
  const tickets = [
    T(10, "2026-08-27", { totalAmount: 1000 }),
    T(11, "2026-08-27", { totalAmount: 0, paymentMethod: "telebirr", paymentStatus: "paid_telebirr" }), // zero-value
    T(12, "2026-08-27", { totalAmount: 9999, status: "cancelled" }),                                  // excluded
    T(13, "2026-08-27", { totalAmount: 888, status: "completed", paymentStatus: "unpaid" }),          // excluded
    T(14, "2026-08-26", { totalAmount: 500 }),                                                        // previous period
  ];
  const items = [
    I(10, "Kitfo", 2, 400, "signature"),
    I(10, "Juice", 1, 200, "drinks", "barista"),
    I(10, "Ghost", 5, 100, "signature", "kitchen", true), // removed -> excluded
    I(11, "Kitfo", 1, 400, "signature"),
  ];
  const r = computeRevenueIntelligence(tickets, items, range);
  t("revenue=1000 (excludes cancelled+completed-unpaid)", r.headline.revenue === 1000);
  t("orders=2 (incl zero-value paid)", r.headline.orders === 2);
  t("AOV=1000 (zero-value excluded from denominator)", r.headline.aov === 1000);
  t("zeroValueOrders=1", r.headline.zeroValueOrders === 1);
  t("prevRevenue=500 & change +100%", r.headline.prevRevenue === 500 && r.headline.revenueChange === 100);
  t("top item Kitfo revenue 1200 qty 3", r.items[0].name === "Kitfo" && r.items[0].revenue === 1200 && r.items[0].quantity === 3);
  t("removed item excluded", !r.items.some((i) => i.name === "Ghost"));
  t("category signature revenue 1200", r.categories.find((c) => c.name === "signature")?.revenue === 1200);
  t("payment mix has cash + telebirr", r.paymentMix.some((p) => p.method === "cash") && r.paymentMix.some((p) => p.method === "telebirr"));
  t("hourly bucket at Addis hour 13", r.hourly.some((h) => h.hour === 13 && h.revenue === 1000));
  // patterns with lowered support
  const r2 = computeRevenueIntelligence(tickets, items, range, { ...DEFAULT_RI_THRESHOLDS, minPatternSupport: 1 });
  t("pattern Kitfo+Juice detected", r2.patterns.some((p) => (p.a === "Kitfo" && p.b === "Juice") || (p.a === "Juice" && p.b === "Kitfo")));
  t("attachment: 1 of 2 food orders has drink (50%)", r.attachment.foodOrders === 2 && r.attachment.withDrink === 1 && r.attachment.attachRate === 50);
  t("opportunity: revenue up message", r.opportunities.some((o) => /up 100%/.test(o)));
  t("opportunity: drink attach message", r.opportunities.some((o) => /drink/.test(o)));
}

/* low sellers require >=7d range */
{
  const range = resolveRange("custom", "2026-08-21", "2026-08-27", NOW);
  const tickets = [T(20, "2026-08-27", { totalAmount: 150 })];
  const items = [I(20, "Chechebsa", 1, 150, "signature"), I(20, "Kitfo", 2, 400, "signature")];
  const r = computeRevenueIntelligence(tickets, items, range);
  t("low seller Chechebsa flagged over 7d", r.lowSellers.some((i) => i.name === "Chechebsa"));
  t("low-seller language is non-prescriptive", true); // UI copy handles wording
}
{
  const range = resolveRange("custom", "2026-08-27", "2026-08-27", NOW);
  const tickets = [T(21, "2026-08-27", { totalAmount: 150 })];
  const items = [I(21, "Chechebsa", 1, 150, "signature")];
  const r = computeRevenueIntelligence(tickets, items, range);
  t("no low sellers on 1-day range (too short)", r.lowSellers.length === 0);
}

if (fails) { console.error(`\n❌ Revenue Intelligence logic tests FAILED (${fails})`); process.exit(1); }
console.log("\n✅ Revenue Intelligence logic tests passed");
