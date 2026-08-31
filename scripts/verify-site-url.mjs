#!/usr/bin/env node
/**
 * Domain-safety guard.
 *  1. NEXT_PUBLIC_SITE_URL is supported by site-url.ts with getConfiguredSiteUrl().
 *  2. .env.example contains ONLY the approved placeholder
 *     (https://your-domain.example) — no guessed/production domain.
 *  3. Metadata/JSON-LD never hard-code a guessed domain: the root layout uses
 *     getSiteUrl() and emits a schema `url` ONLY when the env var is configured.
 *  4. sitemap/robots use getSiteUrl().
 *  5. No Fana domain / guessed Totot domain anywhere in public code or config.
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

const siteUrl = read("src/lib/site-url.ts");
pass("site-url exposes getSiteUrl()", /export function getSiteUrl/.test(siteUrl));
pass("site-url exposes getConfiguredSiteUrl() (env-only)", /export function getConfiguredSiteUrl/.test(siteUrl) && /return null/.test(siteUrl));
pass("site-url has safe localhost fallback", /http:\/\/localhost:3000/.test(siteUrl));
pass("site-url has deployment-host fallbacks", /RAILWAY_PUBLIC_DOMAIN/.test(siteUrl) && /VERCEL_URL/.test(siteUrl));
pass("site-url no longer names another business's domain", !/fanacafe/i.test(siteUrl));

const env = existsSync(join(root, ".env.example")) ? read(".env.example") : "";
pass(".env.example exists", env.length > 0);
pass(".env.example placeholder is the generic example only", /NEXT_PUBLIC_SITE_URL=https:\/\/your-domain\.example/.test(env));
pass(".env.example contains no Fana/guessed domain", !/fanacafe|totottraditional|\.com\.et/.test(env));

const layout = read("src/app/layout.tsx");
pass("root layout metadataBase uses getSiteUrl()", /metadataBase: new URL\(getSiteUrl\(\)\)/.test(layout));
pass("root layout JSON-LD url only when configured", /configuredSiteUrl/.test(layout) && /\.\.\.\(configuredSiteUrl \? \{ url: configuredSiteUrl \} : \{\}\)/s.test(layout));
pass("root layout has no hard-coded domain", !/totottraditionalrestaurant\.com|fanacafe/.test(layout));

const sitemap = read("src/app/sitemap.ts");
const robots = read("src/app/robots.ts");
pass("sitemap uses getSiteUrl()", /getSiteUrl\(\)/.test(sitemap));
pass("robots uses getSiteUrl()", /getSiteUrl\(\)/.test(robots));

const restaurant = read("src/lib/restaurant.ts");
pass("restaurant config has no domain until approved", /website: ""/.test(restaurant) && !/totottraditionalrestaurant\.com/.test(restaurant));

if (failures.length) {
  console.error(`\n❌ Site URL / domain guard FAILED (${failures.length})`);
  process.exit(1);
}
console.log("\n✅ Site URL / domain guard passed");
