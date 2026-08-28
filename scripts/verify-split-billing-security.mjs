#!/usr/bin/env node
/** Regression guard: Split Billing (/api/ticket-payments) authorization + safety. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const fails = [];
const pass = (n, v) => { console.log(`${v ? "✅" : "❌"} ${n}`); if (!v) fails.push(n); };

const route = read("src/app/api/ticket-payments/route.ts");
pass("401 unauthenticated / 403 non-cashier staff", /401/.test(route) && /403/.test(route));
pass("cashier + admin allowed (role check)", /staff\.role !== "cashier"/.test(route) && /readAdminSession/.test(route));
pass("does NOT use requireStaffOrAdmin for settlement (waiter/kitchen/barista denied)", !/requireStaffOrAdmin\(\)\s*;\s*\n\s*if \(!auth/.test(route) && /authorizeSettlement/.test(route));
pass("amount validated server-side", /validatePayment\(/.test(route));
pass("remaining balance server-computed (never trusted from client)", /computeBalance\(/.test(route) && !/body\.remaining|body\.paid\b/.test(route));
pass("idempotency enforced (duplicate returns existing)", /idempotencyKey/.test(route) && /dup\.length > 0/.test(route));
pass("same idempotency key w/ different payload rejected (not silently reused)", /already used with different payment details/.test(route));
pass("transaction + row lock for concurrency", /db\.transaction/.test(route) && /FOR UPDATE/.test(route));
pass("closes only at zero remaining", /bal\.remaining === 0/.test(route));
pass("per-payment receipt persistence", /persistImageRef\(/.test(route));

const tickets = read("src/app/api/tickets/route.ts");
pass("ticket reads expose paid/remaining + payments (no second representation)", /remainingAmount/.test(tickets) && /payments:/.test(tickets));
pass("generic status flip cannot close a partially-settled ticket", /must be settled via payments first/.test(tickets));

const reports = read("src/app/api/reports/route.ts");
pass("reports payment mix reads payment records w/ legacy fallback", /paymentsByTicket/.test(reports));
const ri = read("src/lib/revenue-intelligence.ts");
pass("revenue NOT summed from payments (mix only)", /paysByTicket/.test(ri) && /t\.totalAmount/.test(ri));

const lib = read("src/lib/split-billing.ts");
pass("cancelled/paid tickets cannot receive payments", /cancelled/.test(lib) && /already fully paid/.test(lib));
pass("no duplicate order creation introduced (payments only)", !/insert\(tickets\)|insert\(ticketItems\)/.test(route));

if (fails.length) { console.error(`\n❌ Split Billing security guard FAILED (${fails.length})`); process.exit(1); }
console.log("\n✅ Split Billing security guard passed");
