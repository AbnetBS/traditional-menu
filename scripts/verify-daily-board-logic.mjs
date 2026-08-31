#!/usr/bin/env node
/**
 * Pure-logic tests for Daily Board promotions (src/lib/promotions.ts).
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

const src = readFileSync(join(root, "src/lib/promotions.ts"), "utf8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const dir = mkdtempSync(join(tmpdir(), "promo-"));
const modPath = join(dir, "promotions.mjs");
writeFileSync(modPath, outputText);
const promo = await import(pathToFileURL(modPath).href);

const {
  isPromoLiveToday,
  normalizeMenuItemId,
  normalizePromoPrice,
  applyPromoOverrides,
  applyPromosToItems,
} = promo;

let failures = 0;
const t = (name, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) failures++;
};

/* ── live window (boundaries use UTC date, like effectivePrice) ── */
const TODAY = "2026-08-31";
t("no dates → live", isPromoLiveToday({ startDate: null, endDate: null }, TODAY) === true);
t("starts today → live", isPromoLiveToday({ startDate: TODAY, endDate: null }, TODAY) === true);
t("starts tomorrow → not live", isPromoLiveToday({ startDate: "2026-09-01", endDate: null }, TODAY) === false);
t("ends today → live", isPromoLiveToday({ startDate: null, endDate: TODAY }, TODAY) === true);
t("ended yesterday → not live", isPromoLiveToday({ startDate: null, endDate: "2026-08-30" }, TODAY) === false);
t("window in the middle → live", isPromoLiveToday({ startDate: "2026-08-01", endDate: "2026-09-30" }, TODAY) === true);

/* ── input normalization (client-supplied values) ── */
t("menuItemId unset → null", normalizeMenuItemId(undefined) === null && normalizeMenuItemId("") === null && normalizeMenuItemId(null) === null);
t("menuItemId valid int", normalizeMenuItemId(12) === 12 && normalizeMenuItemId("12") === 12);
t("menuItemId invalid (0 / negative / float / text)", normalizeMenuItemId(0) === "invalid" && normalizeMenuItemId(-3) === "invalid" && normalizeMenuItemId(1.5) === "invalid" && normalizeMenuItemId("x") === "invalid");
t("salePrice unset → null", normalizePromoPrice(undefined) === null && normalizePromoPrice("") === null && normalizePromoPrice(null) === null);
t("salePrice valid int", normalizePromoPrice(500) === 500 && normalizePromoPrice("750") === 750);
t("salePrice invalid (0 / negative / float / text)", normalizePromoPrice(0) === "invalid" && normalizePromoPrice(-1) === "invalid" && normalizePromoPrice(9.5) === "invalid" && normalizePromoPrice("free") === "invalid");

/* ── promo overrides (immutable, only when valid) ── */
{
  const item = { id: 1, price: 1000, salePrice: null, saleStart: null, saleEnd: null };
  const out = applyPromoOverrides(item, { menuItemId: 1, salePrice: 800, startDate: null, endDate: null });
  t("promo applied", out !== item && out.salePrice === 800 && out.saleStart === "" && out.saleEnd === "");
  t("original row untouched", item.salePrice === null);
}
{
  const item = { id: 2, price: 1000, salePrice: null, saleStart: null, saleEnd: null };
  const out = applyPromoOverrides(item, { menuItemId: 2, salePrice: 1000 });
  t("promo price equal to base is ignored", out === item);
}
{
  const item = { id: 3, price: 1000, salePrice: null, saleStart: null, saleEnd: null };
  const out = applyPromoOverrides(item, { menuItemId: 3, salePrice: 1200 });
  t("promo price above base is ignored", out === item);
}
{
  const item = { id: 4, price: 1000, salePrice: 900, saleStart: "2026-08-01", saleEnd: "2026-08-20" };
  const out = applyPromoOverrides(item, { menuItemId: 4, salePrice: 800, startDate: "2026-09-01", endDate: "2026-09-30" });
  t("promo window overrides item window", out.saleStart === "2026-09-01" && out.saleEnd === "2026-09-30");
}
{
  // Daily Board promo window empty → item's own window is preserved (never
  // clears an owner sale by accident).
  const item = { id: 5, price: 1000, salePrice: 900, saleStart: "2026-08-01", saleEnd: "2026-08-20" };
  const out = applyPromoOverrides(item, { menuItemId: 5, salePrice: 800, startDate: null, endDate: null });
  t("empty promo window keeps item window", out.saleStart === "2026-08-01" && out.saleEnd === "2026-08-20");
}
{
  t("applyPromosToItems maps only matched items", ({
    items: applyPromosToItems(
      [{ id: 1, price: 1000 }, { id: 2, price: 500 }],
      new Map([[2, { menuItemId: 2, salePrice: 400 }]])
    ).length === 2
  }).items);
}

if (failures) {
  console.error(`\n❌ Daily Board promotions logic tests FAILED (${failures})`);
  process.exit(1);
}
console.log("\n✅ Daily Board promotions logic tests passed");
