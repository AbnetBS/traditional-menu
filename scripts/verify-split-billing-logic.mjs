#!/usr/bin/env node
/** Pure-logic tests for Split Billing (src/lib/split-billing.ts) — executes the REAL module. */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/split-billing.ts"), "utf8");
const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const dir = mkdtempSync(join(tmpdir(), "sb-"));
writeFileSync(join(dir, "sb.mjs"), outputText);
const sb = await import(pathToFileURL(join(dir, "sb.mjs")).href);
const { computeBalance, splitEven, validatePayment, paidAmount } = sb;

let fails = 0;
const t = (n, c) => { console.log(`${c ? "✅" : "❌"} ${n}`); if (!c) fails++; };
const P = (amount, method = "cash", status = "active") => ({ ticketId: 1, amount, method, status });
const T = (status, total) => ({ id: 1, status, totalAmount: total });

t("no payments → paid 0, remaining total", JSON.stringify(computeBalance(5000, [])) === JSON.stringify({ total: 5000, paid: 0, remaining: 5000 }));
t("one full payment → remaining 0", computeBalance(5000, [P(5000)]).remaining === 0);
t("partial → remaining 3000", computeBalance(5000, [P(2000)]).remaining === 3000);
t("two partials → paid 4500", computeBalance(6000, [P(2000), P(2500)]).paid === 4500);
t("mixed methods sum", paidAmount([P(2000, "cash"), P(2500, "card"), P(1500, "telebirr")]) === 6000);
t("same method multiple times", paidAmount([P(1000, "cash"), P(1000, "cash")]) === 2000);
t("voided excluded", paidAmount([P(2000), P(1000, "card", "void")]) === 2000);
t("exact final payment → remaining 0", computeBalance(6000, [P(2000), P(2500), P(1500)]).remaining === 0);

t("overpayment rejected", validatePayment(T("completed", 5000), [P(2000)], 4000, "cash") !== null);
t("zero rejected", validatePayment(T("completed", 5000), [], 0, "cash") !== null);
t("negative rejected", validatePayment(T("completed", 5000), [], -5, "cash") !== null);
t("non-integer rejected", validatePayment(T("completed", 5000), [], 10.5, "cash") !== null);
t("bad method rejected", validatePayment(T("completed", 5000), [], 100, "bitcoin") !== null);
t("cancelled rejected", validatePayment(T("cancelled", 5000), [], 100, "cash") !== null);
t("already-paid rejected", validatePayment(T("paid", 5000), [], 100, "cash") !== null);
t("valid partial accepted", validatePayment(T("completed", 5000), [], 2000, "cash") === null);
t("payment == remaining accepted", validatePayment(T("completed", 5000), [P(2000)], 3000, "card") === null);

t("even split 6000/3", JSON.stringify(splitEven(6000, 3)) === JSON.stringify([2000, 2000, 2000]));
{ const s = splitEven(1000, 3); t("uneven split sums exactly 1000", s.reduce((a, b) => a + b, 0) === 1000 && s.length === 3); }
{ const s = splitEven(10, 4); t("uneven split 10/4 sums 10", s.reduce((a, b) => a + b, 0) === 10); }
t("total changes after partial → recompute", computeBalance(7500, [P(2000)]).remaining === 5500);

if (fails) { console.error(`\n❌ Split Billing logic tests FAILED (${fails})`); process.exit(1); }
console.log("\n✅ Split Billing logic tests passed");
