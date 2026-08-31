#!/usr/bin/env node
/**
 * Regression guard: customer gallery lightbox (close + previous/next arrows).
 *  1. Gallery tiles in the customer app open the viewer.
 *  2. Viewer has a close button, previous/next buttons and a counter.
 *  3. Keyboard: Escape closes; ArrowLeft/ArrowRight navigate.
 *  4. Body scroll is locked while open and restored on close.
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

const src = read("src/components/rms/CustomerMenuApp.tsx");

pass("lightbox state exists (null = closed)", /lightboxIndex, setLightboxIndex/.test(src) && /useState<number \| null>\(null\)/.test(src));
pass("gallery tiles open the viewer", /onClick=\{\(\) => setLightboxIndex\(i\)\}/.test(src));
pass("viewer has a close button", /aria-label=\{t\("close"\)\}/.test(src) && /onClick=\{closeLightbox\}/.test(src));
pass("viewer has previous + next buttons", /aria-label=\{t\("previous"\)\}/.test(src) && /aria-label=\{t\("next"\)\}/.test(src));
pass("prev/next cycle safely (modulo, wraps)", /stepLightbox\(-1\)/.test(src) && /stepLightbox\(1\)/.test(src) && /galleryPhotos.length\) % galleryPhotos.length/.test(src));
pass("counter shows position (n / total)", /lightboxIndex \+ 1\}/.test(src) && /galleryPhotos\.length\}/.test(src));
pass("keyboard: Escape closes", /e\.key === "Escape"/.test(src) && /closeLightbox\(\)/.test(src));
pass("keyboard: ArrowLeft / ArrowRight navigate", /e\.key === "ArrowLeft"/.test(src) && /e\.key === "ArrowRight"/.test(src));
pass("body scroll locked while open, restored on close", /document\.body\.style\.overflow = "hidden"/.test(src) && /prevOverflow/.test(src));
pass("backdrop click closes", /onClick=\{closeLightbox\}/.test(src));
pass("i18n provides close/previous/next labels", (() => {
  const i18n = read("src/lib/i18n.ts");
  const en = i18n.split("// Amharic")[0] ?? "";
  return /close: "Close"/.test(en) && /previous: "Previous"/.test(en) && /next: "Next"/.test(en);
})());

if (failures.length) {
  console.error(`\n❌ Gallery lightbox guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Gallery lightbox guard passed");
