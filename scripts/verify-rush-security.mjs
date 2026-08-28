#!/usr/bin/env node
/**
 * Regression guard: Rush Mode (/api/rush) authorization + safety.
 *
 *  1. Owner/admin gets 200; a logged-in staff member gets 403; no session 401.
 *     (Implemented via readAdminSession + readStaffSession — NOT
 *     requireStaffOrAdmin, which would wrongly admit staff.)
 *  2. The endpoint is read-only and never mutates tickets/items/calls.
 *  3. It aggregates server-side over OPEN tickets only (bounded), never
 *     returning the full order history to the browser.
 *  4. No new timestamp columns are required (v1 uses existing fields).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const failures = [];
const pass = (name, value) => {
  console.log(`${value ? "✅" : "❌"} ${name}`);
  if (!value) failures.push(name);
};

const route = read("src/app/api/rush/route.ts");

pass("rush distinguishes admin (200) / staff (403) / none (401)", /readAdminSession/.test(route) && /readStaffSession/.test(route) && /403/.test(route) && /401/.test(route));
pass("rush does NOT use requireStaffOrAdmin (staff must be forbidden)", !/requireStaffOrAdmin\(\)/.test(route));
pass("rush is read-only (no update/insert/delete on operational tables)", !/\.update\(|\.insert\(|\.delete\(/.test(route));
pass("rush reads only OPEN tickets (bounded, not full history)", /notInArray\(tickets\.status, \["paid", "cancelled"\]\)/.test(route));
pass("rush aggregation lives in a pure module (testable)", /from "@\/lib\/rush"/.test(route));

const lib = read("src/lib/rush.ts");
// The honesty note *mentions* the missing columns, so check for property ACCESS,
// not mere presence: v1 must never read .confirmed_at / .ready_at / .accepted_at.
pass("rush v1 never reads missing columns (confirmed_at/ready_at/accepted_at)", !/\.(confirmed_at|ready_at|accepted_at)\b/.test(lib));
pass("rush documents approximate ready-age honesty", /updated_at|approximate|last update/i.test(lib));

if (failures.length) {
  console.error(`\n❌ Rush security guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Rush Mode security guard passed");
