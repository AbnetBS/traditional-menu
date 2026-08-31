import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RESTAURANT } from "@/lib/restaurant";
import { getConfiguredSiteUrl, getSiteUrl } from "@/lib/site-url";

const { identity, contact } = RESTAURANT;
// Client-approved domain only — set in Coolify before production. Until then
// metadata falls back to the deployment host / localhost (never a guessed URL).
const configuredSiteUrl = getConfiguredSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${identity.name} | ${identity.nameAm} — Addis Ababa`,
    template: `%s — ${identity.name}`,
  },
  description:
    "Totot Traditional Food Hall in Gerji, Addis Ababa — a 24-hour cultural hall for Southern Ethiopian cooking. Special Kitfo, Shekla Tibs, Beyaynetu, live traditional music and dance, and the jebena buna ceremony. Scan your table QR to order, or plan your evening online.",
  keywords: [
    "Totot",
    "ቶቶት",
    "Totot Traditional Food Hall",
    "Gerji restaurant",
    "Ethiopian traditional restaurant Addis Ababa",
    "Special Kitfo",
    "traditional dance Addis",
    "coffee ceremony",
    "QR menu Ethiopia",
  ],
  authors: [{ name: "AB Web" }],
  creator: "AB Web",
  publisher: "AB Web",
  icons: {
    // Client-approved Totot logo (public/totot-logo.png).
    icon: identity.defaultLogo,
    apple: identity.defaultLogo,
  },
  openGraph: {
    type: "website",
    locale: "en_ET",
    alternateLocale: "am_ET",
    siteName: identity.name,
    title: `${identity.name} | ${identity.nameAm}`,
    description: identity.tagline,
  },
};

export const viewport: Viewport = {
  themeColor: RESTAURANT.tokens.obsidian,
  colorScheme: "dark",
};

/**
 * Ethiopian food & beverage structured data. This is what makes the site show
 * up as a rich result ("★ 4.1 · Open 24 hours") rather than a bare blue link,
 * which matters because Totot is discovered almost entirely through search.
 */
const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: identity.name,
  alternateName: identity.nameAm,
  servesCuisine: ["Ethiopian", "Gurage", "Southern Ethiopian", "Traditional"],
  priceRange: "ETB 5,000+",
  telephone: contact.phone,
  // No `url` until the client approves a domain: NEXT_PUBLIC_SITE_URL is set
  // in Coolify before production, and only then is a canonical URL emitted
  // (never localhost, never a guessed domain).
  ...(configuredSiteUrl ? { url: configuredSiteUrl } : {}),
  acceptsReservations: "True",
  address: {
    "@type": "PostalAddress",
    streetAddress: contact.address,
    addressLocality: "Addis Ababa",
    addressRegion: "Addis Ababa",
    addressCountry: "ET",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: contact.lat,
    longitude: contact.lng,
  },
  hasMap: contact.social.mapsUrl,
  /** Official social profiles — client-approved URLs only. */
  sameAs: [contact.social.facebook, contact.social.instagram, contact.social.tiktok],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: contact.googleRating,
    reviewCount: contact.googleReviewCount,
    bestRating: "5",
  },
  amenitiesFeature: [
    { "@type": "LocationFeatureSpecification", name: "Live traditional music", value: true },
    { "@type": "LocationFeatureSpecification", name: "Traditional dance performance", value: true },
    { "@type": "LocationFeatureSpecification", name: "Coffee ceremony (jebena buna)", value: true },
    { "@type": "LocationFeatureSpecification", name: "Dine-in", value: true },
    { "@type": "LocationFeatureSpecification", name: "Takeaway", value: true },
    { "@type": "LocationFeatureSpecification", name: "Delivery", value: true },
    { "@type": "LocationFeatureSpecification", name: "Open 24 hours", value: true },
  ],
};

/**
 * Webfonts. Amharic is a first-class language here, so the Ethiopic faces are
 * loaded with the same weight range as the Latin ones — it must never fall back
 * to a mismatched system font while the Latin text renders correctly.
 * `display=swap` keeps text visible while the faces load.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500",
    "family=Inter:wght@400;500;600;700;800",
    "family=Noto+Sans+Ethiopic:wght@400;500;600;700",
    "family=Noto+Serif+Ethiopic:wght@500;600;700",
  ].join("&") +
  "&display=swap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />

        {/* Menu/gallery photography is served from Pexels URLs by the seed data. */}
        <link rel="preconnect" href="https://images.pexels.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />

        <script
          type="application/ld+json"
          // Static, developer-authored JSON — no user input reaches this object.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />
      </head>
      <body className="bg-obsidian text-ivory antialiased">{children}</body>
    </html>
  );
}
