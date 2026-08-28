#!/usr/bin/env node
/**
 * Regression guard: Order Health (/api/order-health) authorization + safety.
 *  1. admin 200 / staff 403 / none 401 (readAdminSession + readStaffSession,
 *     NOT requireStaffOrAdmin).
 *  2. GET-only, read-only (no update/insert/delete).
 *  3. Bounded to OPEN tickets (paid/cancelled excluded) — no history leak.
 *  4. No customer-sensitive fields selected.
 *  5. No new timestamp columns read (confirmed_at/ready_at/accepted_at/done_at).
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

const route = read("src/app/api/order-health/route.ts");
pass("order-health distinguishes admin/staff/none (200/403/401)", /readAdminSession/.test(route) && /readStaffSession/.test(route) && /403/.test(route) && /401/.test(route));
pass("order-health does NOT use requireStaffOrAdmin", !/requireStaffOrAdmin\(\)/.test(route));
pass("order-health is GET-only and read-only", !/export async function (POST|PUT|DELETE|PATCH)/.test(route) && !/\.update\(|\.insert\(|\.delete\(/.test(route));
pass("order-health bounded to OPEN tickets", /notInArray\(tickets\.status, \["paid", "cancelled"\]\)/.test(route));
pass("order-health avoids N+1 (batch item load via inArray)", /inArray\(ticketItems\.ticketId/.test(route));
pass("order-health does not expose customer-sensitive fields", !/customer_name|phone|receiptImage/.test(route));

const lib = read("src/lib/order-health.ts");
pass("order-health never reads missing timestamp columns", !/\.(confirmed_at|ready_at|accepted_at|done_at)\b/.test(lib));
pass("order-health uses centralized tunable thresholds", /DEFAULT_ORDER_HEALTH_THRESHOLDS/.test(lib) && /warnFraction/.test(lib));
pass("order-health does not treat menu prepTime as authoritative", !/prepTime/.test(lib));

if (failures.length) {
  console.error(`\n❌ Order Health security guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Order Health security guard passed");
