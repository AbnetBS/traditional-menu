import type { Metadata } from "next";
import { RESTAURANT } from "@/lib/restaurant";

/**
 * Unique metadata for the customer menu page (/menu).
 *
 * The business name comes from the configured restaurant
 * (src/lib/restaurant.ts — the same source the public site uses), so it is
 * never duplicated from another business's data. No canonical URL is set
 * here: the production domain must be supplied by the client
 * (NEXT_PUBLIC_SITE_URL, set in Coolify before deployment).
 */
export const metadata: Metadata = {
  title: "Menu — Order from Your Table",
  description: `${RESTAURANT.identity.name} — ${RESTAURANT.identity.tagline} Scan your table QR code to browse the menu and order. ${RESTAURANT.identity.nameAm}`,
  robots: {
    index: true,
    follow: true,
  },
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
