/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEFAULT / SEED DATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  These defaults are what a FRESH database gets from the owner-invoked setup
 *  (/api/setup, /api/seed). They are derived from the configured restaurant
 *  (src/lib/restaurant.ts) and the bundled design-time menu
 *  (src/lib/totot-demo.ts) — they must NEVER contain another business's
 *  name, contact details, menu or reviews.
 *
 *  Reviews and gallery photos are deliberately EMPTY: the owner adds real,
 *  approved content from the admin dashboard. Nothing here invents ratings,
 *  reviews, opening hours or address details.
 */

import { RESTAURANT } from "@/lib/restaurant";
import { TOTOT_CATEGORIES, TOTOT_MENU_ITEMS } from "@/lib/totot-demo";

export const DEFAULT_SETTINGS = {
  cafe_name: RESTAURANT.identity.name,
  tagline: RESTAURANT.identity.tagline,
  hero_title: RESTAURANT.identity.tagline,
  hero_subtitle: RESTAURANT.identity.story,
  hero_bg_image: "/images/hero-hall.jpg",
  phone: RESTAURANT.contact.phoneDisplay,
  address: RESTAURANT.contact.address,
  plus_code: RESTAURANT.contact.plusCode,
  lat: RESTAURANT.contact.lat,
  lng: RESTAURANT.contact.lng,
  google_rating: RESTAURANT.contact.googleRating,
  google_review_count: RESTAURANT.contact.googleReviewCount,
  opening_hours: RESTAURANT.contact.hoursNote,
  about_title: `About ${RESTAURANT.identity.shortName}`,
  about_description: RESTAURANT.identity.story,
  // No invented welcome copy — the owner posts Daily Board items themselves.
  announcement: "",
  logo_url: "",
  receipt_enabled: "true",
  // Dev-only default; production setup never seeds a password
  // (see src/lib/seed-db.ts) — the owner sets ADMIN_PASSWORD in Coolify.
  admin_password: "change-me-before-launch",
};

export const DEFAULT_TABLES = Array.from({ length: 10 }, (_, i) => ({
  name: `Table ${i + 1}`,
  sortOrder: i + 1,
}));

/**
 * Station routing for the configured category slugs.
 * Drinks & buna → barista; everything food-tier → kitchen (chef).
 */
export const DEFAULT_CATEGORY_ROUTING: Record<string, "barista" | "kitchen"> = {
  "signature-raw": "kitchen",
  "traditional-mains": "kitchen",
  "fasting-veg": "kitchen",
  "drinks": "barista",
  "buna": "barista",
  "all": "kitchen",
};

/**
 * Neutral placeholder staff accounts for a fresh setup. The owner renames
 * them / assigns real PINs in the Staff tab — no invented staff identities
 * ship with the engine.
 */
export const DEFAULT_STAFF = [
  { name: "Waiter 1", role: "waiter", pin: "1111" },
  { name: "Waiter 2", role: "waiter", pin: "3333" },
  { name: "Cashier 1", role: "cashier", pin: "2222" },
  { name: "Barista 1", role: "barista", pin: "4444" },
  { name: "Chef 1", role: "kitchen", pin: "5555" },
];

export const DEFAULT_CATEGORIES = TOTOT_CATEGORIES;

/**
 * Categories the owner marked unnecessary (kept empty for the current
 * config — the seed may insert every bundled category).
 */
export const REMOVED_DEFAULT_CATEGORY_SLUGS: string[] = [];

// Legacy slug → new category slug mapping (kept for engine parity; the
// current bunded menu already uses its final slugs).
export const CATEGORY_SLUG_MAP: Record<string, string> = {};

export const DEFAULT_MENU_ITEMS = TOTOT_MENU_ITEMS;

/**
 * No default reviews — the owner imports/approves real customer reviews.
 * Invented ratings and reviews must never ship.
 */
export const DEFAULT_REVIEWS: Array<{
  customerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  isApproved: boolean;
  isVerified: boolean;
}> = [];

/**
 * No default gallery photos — the owner uploads approved venue photos.
 */
export const DEFAULT_GALLERY: Array<{
  title: string;
  category: string;
  imageUrl: string;
  caption?: string;
  sortOrder: number;
}> = [];
