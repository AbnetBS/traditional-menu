#!/usr/bin/env node
/**
 * Pure-logic tests for the Order Health engine (src/lib/order-health.ts).
 * Transpiles the REAL module with the project's TypeScript and runs boundary +
 * scenario assertions against it (no reimplementation).
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const src = readFileSync(join(root, "src/lib/order-health.ts"), "utf8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const dir = mkdtempSync(join(tmpdir(), "oh-"));
const modPath = join(dir, "order-health.mjs");
writeFileSync(modPath, outputText);
const oh = await import(pathToFileURL(modPath).href);

const { classifyAge, computeOrderHealth, DEFAULT_ORDER_HEALTH_THRESHOLDS } = oh;
let failures = 0;
const t = (name, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) failures++;
};

/* ── boundary conditions (target=10, warn=0.7 → warn at 7) ── */
const W = true, P = false;
t("6:59 waiting → WAITING", classifyAge(6.983, 10, 0.7, W) === "WAITING");
t("7:00 waiting → AT_RISK", classifyAge(7, 10, 0.7, W) === "AT_RISK");
t("9:59 → AT_RISK", classifyAge(9.983, 10, 0.7, W) === "AT_RISK");
t("10:00 → DELAYED", classifyAge(10, 10, 0.7, W) === "DELAYED");
t("10:01 → DELAYED", classifyAge(10.016, 10, 0.7, W) === "DELAYED");
t("6:59 progressing → HEALTHY", classifyAge(6.983, 10, 0.7, P) === "HEALTHY");
t("null age waiting → WAITING", classifyAge(null, 10, 0.7, W) === "WAITING");
t("null age progressing → HEALTHY", classifyAge(null, 10, 0.7, P) === "HEALTHY");

/* ── scenario helpers ── */
const NOW = new Date("2026-08-27T12:00:00Z");
const minAgo = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const th = DEFAULT_ORDER_HEALTH_THRESHOLDS;

const run = (tickets, items = [], calls = []) =>
  computeOrderHealth(tickets, items, calls, NOW, th);

/* waiter delay */
{
  const s = run([{ id: 1, orderNumber: "FANA-1", tableId: 1, tableName: "T1", status: "pending_waiter", createdAt: minAgo(6), updatedAt: minAgo(6) }]);
  t("waiter 6m (>5) → DELAYED @WAITER", s.tickets[0].state === "DELAYED" && s.tickets[0].where === "WAITER");
}
/* kitchen delay + worst-item rollup (healthy kitchen item + delayed kitchen item) */
{
  const s = run(
    [{ id: 2, orderNumber: "FANA-2", tableId: 2, tableName: "T2", status: "confirmed", createdAt: minAgo(20), updatedAt: minAgo(1) }],
    [
      { ticketId: 2, name: "Kitfo", quantity: 1, stationName: "kitchen", stationStatus: "accepted", createdAt: minAgo(5) },
      { ticketId: 2, name: "Tibs", quantity: 1, stationName: "kitchen", stationStatus: "pending", createdAt: minAgo(16) },
    ]
  );
  t("kitchen item 16m (>15) → ticket DELAYED @KITCHEN", s.tickets[0].state === "DELAYED" && s.tickets[0].where === "KITCHEN");
}
/* barista at-risk */
{
  const s = run(
    [{ id: 3, orderNumber: "FANA-3", tableId: 3, tableName: "T3", status: "confirmed", createdAt: minAgo(9), updatedAt: minAgo(1) }],
    [{ ticketId: 3, name: "Juice", quantity: 2, stationName: "barista", stationStatus: "pending", createdAt: minAgo(8) }]
  );
  t("barista 8m (>=7 warn, <10) → AT_RISK @BARISTA", s.tickets[0].state === "AT_RISK" && s.tickets[0].where === "BARISTA");
}
/* ready-for-payment approximation */
{
  const s = run([{ id: 4, orderNumber: "FANA-4", tableId: 4, tableName: "T4", status: "ready_for_payment", createdAt: minAgo(30), updatedAt: minAgo(11) }]);
  t("ready 11m (>10) → DELAYED @PAYMENT", s.tickets[0].state === "DELAYED" && s.tickets[0].where === "PAYMENT");
}
/* service warning is separate from food health */
{
  const s = run(
    [{ id: 5, orderNumber: "FANA-5", tableId: 5, tableName: "T5", status: "preparing", createdAt: minAgo(5), updatedAt: minAgo(1) }],
    [{ ticketId: 5, name: "Kitfo", quantity: 1, stationName: "kitchen", stationStatus: "accepted", createdAt: minAgo(4) }],
    [{ tableId: 5, kind: "waiter", status: "new", createdAt: minAgo(7) }]
  );
  t("healthy food + 7m call → stays non-delayed but warns", s.tickets[0].state !== "DELAYED" && s.tickets[0].serviceWarning !== null && s.counts.serviceWarnings === 1);
}
/* multiple stations — offending barista surfaces */
{
  const s = run(
    [{ id: 6, orderNumber: "FANA-6", tableId: 6, tableName: "T6", status: "confirmed", createdAt: minAgo(20), updatedAt: minAgo(1) }],
    [
      { ticketId: 6, name: "Kitfo", quantity: 2, stationName: "kitchen", stationStatus: "done", createdAt: minAgo(20) },
      { ticketId: 6, name: "Coffee", quantity: 2, stationName: "barista", stationStatus: "pending", createdAt: minAgo(12) },
    ]
  );
  t("done kitchen + delayed barista → DELAYED @BARISTA", s.tickets[0].state === "DELAYED" && s.tickets[0].where === "BARISTA");
}
/* empty items + missing optional fields → no crash, sensible defaults */
{
  const s = run(
    [{ id: 7, orderNumber: null, tableId: 7, tableName: "T7", status: "confirmed", createdAt: minAgo(2), updatedAt: minAgo(1) }],
    [{ ticketId: 7, name: "X", quantity: null, stationName: null, stationStatus: null, createdAt: null }]
  );
  t("missing fields handled (kitchen default, qty 1, no crash)", s.tickets[0].items[0].station === "kitchen" && s.tickets[0].items[0].quantity === 1);
}

if (failures) {
  console.error(`\n❌ Order Health logic tests FAILED (${failures})`);
  process.exit(1);
}
console.log("\n✅ Order Health logic tests passed");
