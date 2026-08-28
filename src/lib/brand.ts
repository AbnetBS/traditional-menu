import { RESTAURANT } from "@/lib/restaurant";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  BRAND GUARD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Every display path routes through here so one venue can never leak into
 *  another. This matters specifically for Totot: the codebase is derived from
 *  the Fana Cafe build, and a database carried over (or an old cached row, or a
 *  stale localStorage menu) can still say "Fana Cafe & Restaurant" /
 *  "Town Square Building". Those must never render on a Totot screen.
 *
 *  Nothing here is Totot-specific: the names come from `@/lib/restaurant`, so
 *  onboarding the next traditional restaurant is a config swap.
 */

const BRAND = RESTAURANT.identity.brandName;
const { address } = RESTAURANT.contact;

/** Venues whose text must never appear on this deployment. */
const LEGACY_BRANDS = [
  /\bfanaqueen(\s+cafe)?\b/i,
  /\bfana\s+cafe\s*&?\s*(and\s+)?restaurant\b/i,
  /\bfana\s+cafe\b/i,
  /\bfana\s+restaurant\b/i,
];

const LEGACY_ADDRESSES = [
  /town\s+square\s+(building|bldg\.?)/i,
  /22\s+square/i,
  /djibouti\s+street/i,
  /\bbole\b(?=.*,?\s*addis)/i,
];

export const BRAND_NAME = BRAND;

/**
 * Repairs a business name: legacy venues, doubled words ("Cafe Cafe") and
 * half-names ("Totot") all resolve to the full brand name. Free text that
 * happens to contain none of them is returned untouched.
 */
export function fixBrandText(v: unknown): string {
  if (typeof v !== "string" || !v) return v as string;

  let out = v
    .replace(/\b(\w+)\s+\1(\s+\1)?\b/gi, "$1") // "Cafe Cafe" → "Cafe"
    .replace(/\s{2,}/g, " ")
    .trim();

  const bare = out.replace(/[^\p{L}\p{N}\s&]/gu, "").trim();

  // A legacy venue name → this venue.
  if (LEGACY_BRANDS.some((re) => re.test(bare))) return BRAND;

  // Just the short mark ("TOTOT", "ቶቶት") → the full brand name.
  const short = RESTAURANT.identity.shortName.toLowerCase();
  const nameAm = RESTAURANT.identity.nameAm;
  if (bare && (bare.toLowerCase() === short || bare === nameAm)) return BRAND;

  // Already the right name with odd casing/spacing → normalize once.
  if (bare.toLowerCase() === BRAND.toLowerCase()) return BRAND;

  return out;
}

/**
 * Repairs an address. A carried-over Fana row pointing at Town Square Building
 * must not be served as Totot's location — guests would drive to the wrong
 * sub-city, which is a 20-minute mistake in Addis traffic.
 */
export function fixAddressText(v: unknown): string {
  if (typeof v !== "string" || !v) return v as string;

  const looksLikeLegacyAddress = LEGACY_ADDRESSES.some((re) => re.test(v));
  const looksLikeAnAddress = /\b(addis|street|building|bldg|sub ?city|road)\b/i.test(v);

  if (looksLikeLegacyAddress && looksLikeAnAddress) return address;

  return v.replace(/\s{2,}/g, " ").trim();
}

/** Combined normalizer for serving text content to clients. */
export function fixSiteText(v: unknown): string {
  return fixAddressText(fixBrandText(v));
}
