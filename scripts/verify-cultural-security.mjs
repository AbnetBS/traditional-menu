#!/usr/bin/env node
/**
 * Regression guard: the Cultural Content Manager API (/api/cultural) stays
 * authorization-safe and degradation-safe.
 *
 * Static assertions (the live HTTP auth behaviour is additionally exercised in
 * the sandbox: unauthenticated POST/PUT/DELETE and ?scope=admin all → 401,
 * public GET → 200 active-only).
 *
 *  1. Every write (POST/PUT/DELETE) requires the OWNER/admin session.
 *  2. `?scope=admin` (the only path that exposes drafts/inactive) requires admin.
 *  3. Writes are gated by requireAdmin — NOT requireStaffOrAdmin — so waiter,
 *     cashier, kitchen and barista sessions can never modify cultural content.
 *  4. The public GET hides drafts and inactive rows.
 *  5. ids and kind are validated; bad input → 400/401, never a crash.
 *  6. Uploaded images go through persistImageRef (server-side MIME/size/magic
 *     validation) and orphaned blobs are cleaned up.
 *  7. When the database is unavailable, admin writes return 503 (a real error),
 *     never a fake success.
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

const route = read("src/app/api/cultural/route.ts");

// Count requireAdmin occurrences: POST, PUT, DELETE, and scope=admin GET.
const adminGuards = (route.match(/await requireAdmin\(\)/g) || []).length;
pass("all four handlers (GET-scope/POST/PUT/DELETE) require the admin session", adminGuards >= 4);

// Writes must NOT be satisfiable by a staff (waiter/cashier/kitchen/barista) session.
pass("cultural writes are admin-only (requireStaffOrAdmin is not used for this API)", !/requireStaffOrAdmin/.test(route));

// scope=admin path gates on auth before returning inactive/draft rows.
pass("scope=admin requires auth before exposing drafts/inactive", /scope.*===\s*"admin"[\s\S]{0,200}requireAdmin/.test(route));

// Public GET hides drafts and inactive rows.
pass("public read filters out drafts and inactive rows", /status !== "draft"/.test(route) && /active !== false/.test(route));

// Input validation.
pass("ids are integer-validated on PUT/DELETE", (route.match(/Number\.isInteger\(id\)/g) || []).length >= 2);
pass("kind is validated against the allow-list", /KINDS\.includes\(kind\)/.test(route));

// Image handling reuses the safe persistence + orphan-cleanup paths.
pass("uploads are persisted via persistImageRef (server-side validation)", /persistImageRef\(/.test(route));
pass("orphaned cultural images are cleaned up on update/delete", /deleteOrphanedCdnImages\(/.test(route));

// Degradation: admin writes fail loudly when the DB is down (no fake success).
pass("admin writes return 503 (not a fake success) when the database is unavailable", /503/.test(route) && /not saved/i.test(route));

// The cultural image column participates in the global orphan-reference count so
// a cultural photo is never deleted while still referenced.
const store = read("src/lib/image-store.ts");
pass("countReferences includes cultural_content images", /culturalContent/.test(store));

if (failures.length) {
  console.error(`\n❌ Cultural security guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Cultural Content Manager security guard passed");
