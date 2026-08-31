#!/usr/bin/env node
/**
 * Official social / Maps / logo guard.
 *  1. Approved Facebook, Instagram, TikTok and Google Maps URLs live in the
 *     restaurant config (src/lib/restaurant.ts) — never placeholders.
 *  2. Public surfaces (homepage footer, customer-menu footer) render them.
 *  3. JSON-LD emits hasMap + sameAs from that config.
 *  4. The Fana Queen badge (public/logo.png, photo_*.jpg) is NEVER referenced
 *     by the app; the neutral Totot mark is the default logo.
 *  5. No generic/invented social placeholders (facebook.com, instagram.com,
 *     t.me, tiktok.com root) anywhere in public code.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const failures = [];
const pass = (name, v) => {
  console.log(`${v ? "✅" : "❌"} ${name}`);
  if (!v) failures.push(name);
};

const resto = read("src/lib/restaurant.ts");
const has = (needle) => resto.includes(needle);

pass("config has official Facebook URL", has("https://web.facebook.com/TototTraditionalRestaurant/"));
pass("config has official Instagram URL", has("https://www.instagram.com/totottraditionalresturant/"));
pass("config has official TikTok URL", has("https://www.tiktok.com/@totottraditional"));
pass("config has official Google Maps listing URL", /social:\s*\{[\s\S]*?mapsUrl:\s*"https:\/\/www\.google\.com\/maps\/place\/Totot/.test(resto));
pass("config default logo is the approved Totot logo", has('defaultLogo: "/totot-logo.png"'));
// Comments explaining the Fana Queen badge are fine; the CONFIG must not use it.
const restoCode = resto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
pass("config does NOT claim the Fana Queen logo", !/"logo\.png"/.test(restoCode));
pass("approved Totot logo file is present in public/", existsSync(join(root, "public/totot-logo.png")));
pass("Fana Queen logo files are NOT in public/", !existsSync(join(root, "public/logo.png")) && !existsSync(join(root, "photo_2026-08-15_13-45-10.jpg")));

const customer = read("src/components/rms/CustomerMenuApp.tsx");
pass("customer footer renders official Facebook", /social\.facebook/.test(customer) && /Facebook/.test(customer));
pass("customer footer renders official Instagram", /social\.instagram/.test(customer) && /Instagram/.test(customer));
pass("customer footer renders official TikTok", /social\.tiktok/.test(customer) && /TikTok/.test(customer));
pass("customer Find-Us uses official Maps URL", /contact\.social\.mapsUrl/.test(customer));
pass("customer menu never falls back to the Fana Queen badge", !/settings\.logo_url \|\| "\/logo\.png"/.test(customer) && /RESTAURANT\.identity\.defaultLogo/.test(customer));

const culturalFooter = read("src/components/cultural/CulturalFooter.tsx");
pass("homepage footer renders Facebook, Instagram, TikTok, Maps", /social\.facebook/.test(culturalFooter) && /social\.instagram/.test(culturalFooter) && /social\.tiktok/.test(culturalFooter) && /social\.mapsUrl/.test(culturalFooter));

const layout = read("src/app/layout.tsx");
pass("JSON-LD hasMap = official Maps URL", /hasMap: contact\.social\.mapsUrl/.test(layout));
pass("JSON-LD sameAs = official socials", /sameAs: \[contact\.social\.facebook, contact\.social\.instagram, contact\.social\.tiktok\]/.test(layout));
pass("favicon = approved Totot logo", /icon: identity\.defaultLogo/.test(layout) && !/"\/logo\.png"/.test(layout));

// No generic placeholders anywhere in src public components.
const srcFiles = [
  "src/components/rms/CustomerMenuApp.tsx",
  "src/components/cultural/CulturalFooter.tsx",
  "src/components/cultural/VisitSection.tsx",
  "src/app/layout.tsx",
];
const blocked = [/href="https:\/\/facebook\.com"/, /href="https:\/\/instagram\.com"/, /href="https:\/\/t\.me"/, /href="https:\/\/tiktok\.com"/, /href="https:\/\/twitter\.com"/];
const genericHits = srcFiles.filter((f) => blocked.some((re) => re.test(read(f))));
pass("no generic social placeholders in public surfaces", genericHits.length === 0);

if (failures.length) {
  console.error(`\n❌ Official links guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Official links guard passed");
