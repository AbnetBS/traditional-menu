#!/usr/bin/env node
/**
 * Regression guard: Revenue Intelligence (/api/revenue-intelligence) safety.
 *  1. admin 200 / staff 403 / none 401 (readAdminSession + readStaffSession).
 *  2. GET-only, read-only.
 *  3. revenue predicate excludes cancelled & completed-unpaid; removed items excluded.
 *  4. server-side aggregation (bounded tickets scan + one batched item read, no N+1).
 *  5. no customer-identity / profit-margin / package-revenue / marketing claims.
 *  6. date range bounded.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const fails = [];
const pass = (n, v) => { console.log(`${v ? "✅" : "❌"} ${n}`); if (!v) fails.push(n); };

const route = read("src/app/api/revenue-intelligence/route.ts");
pass("admin/staff/none authorization (200/403/401)", /readAdminSession/.test(route) && /readStaffSession/.test(route) && /403/.test(route) && /401/.test(route));
pass("does NOT use requireStaffOrAdmin", !/requireStaffOrAdmin\(\)/.test(route));
pass("GET-only and read-only", !/export async function (POST|PUT|DELETE|PATCH)/.test(route) && !/\.update\(|\.insert\(|\.delete\(/.test(route));
pass("bounded tickets scan (createdAt/closedAt window)", /gte\(tickets\.createdAt/.test(route) && /lte\(tickets\.createdAt/.test(route));
pass("single batched item read (no N+1)", /inArray\(ticketItems\.ticketId/.test(route));

const libRaw = read("src/lib/revenue-intelligence.ts");
// Strip doc/line comments so honesty notes ("not profit intelligence", etc.)
// don't false-positive; the checks below target ACTUAL code.
const lib = libRaw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
pass("revenue predicate excludes cancelled", /cancelled/.test(lib) && /return false/.test(lib));
pass("revenue predicate requires payment verification (paid or paid_*)", /status === "paid"/.test(lib) && /PAID_STATUSES/.test(lib));
pass("removed items excluded", /it\.removed/.test(lib));
pass("no profit/margin computation in code", !/profit|margin/i.test(lib));
pass("no customer-identity analytics in code", !/returning|lifetime|retention|cohort/i.test(lib));
pass("no package/tonight revenue in code", !/packageRevenue|tonightRevenue/i.test(lib));
pass("no marketing attribution in code", !/campaign|referral|promoCode/i.test(lib));
pass("date range bounded (max 366 days)", /366/.test(lib));
pass("AOV guards zero orders", /positive > 0/.test(lib));

if (fails.length) { console.error(`\n❌ Revenue Intelligence security guard FAILED (${fails.length})`); process.exit(1); }
console.log("\n✅ Revenue Intelligence security guard passed");
