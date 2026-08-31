/**
 * Canonical public site URL used for SEO artifacts (sitemap.xml, robots.txt)
 * and metadata generation.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — the CLIENT-APPROVED production domain, set as an
 *      environment variable (e.g. in Coolify) before production deployment.
 *      Example only: https://your-domain.example — never a guessed domain.
 *   2. RAILWAY_PUBLIC_DOMAIN — auto-provided by Railway when deployed there.
 *   3. VERCEL_URL            — auto-provided by Vercel when deployed there.
 *   4. http://localhost:3000 — local development fallback only.
 *
 * Until the client approves a real domain, the deployment-host / localhost
 * fallback is used — nothing canonical points at an unowned domain.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${stripTrailingSlash(railway)}`;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

/**
 * The client-approved domain ONLY — returns null when NEXT_PUBLIC_SITE_URL is
 * unset. Use this when a value must NOT fall back to localhost (e.g. structured
 * data URLs, canonical links).
 */
export function getConfiguredSiteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  return stripTrailingSlash(configured);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
