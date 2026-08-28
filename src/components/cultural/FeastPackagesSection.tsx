"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SHARE THE TABLE  ·  በአንድ ሳህን ይተባበሩ
 * ═══════════════════════════════════════════════════════════════════════════
 *  This is a revenue feature dressed as hospitality, and that is the point.
 *
 *  Ethiopian dining is communal by default — the mesob is built for sharing.
 *  A QR menu that only lists single dishes fights that habit and quietly
 *  caps the bill. Curated packages do the opposite: they match how guests
 *  actually eat, decide for a table of ten in one tap, and raise average order
 *  value without a single upsell pop-up.
 *
 *  The "save ETB n" badge is computed from `alaCarte`, never typed, so the
 *  owner cannot accidentally promise a saving that does not exist.
 */

import { useMemo, useState } from "react";
import { Users, Heart, Leaf, Flame, Coffee, PartyPopper, Check } from "lucide-react";
import {
  RESTAURANT,
  packageSaving,
  type FeastPackage,
} from "@/lib/restaurant";
import { useCulturalContent } from "@/lib/use-cultural";
import { useLang } from "@/lib/i18n";
import { optimizeImageUrl } from "@/lib/image-utils";
import { TibebBand } from "@/components/cultural/Patterns";

const ICONS: Record<string, typeof Users> = {
  Users,
  Heart,
  Leaf,
  Flame,
  Coffee,
  PartyPopper,
};

/** ETB with thousands separators — "3,450 ETB", not "3450". */
export function formatETB(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} ETB`;
}

function PackageCard({
  pkg,
  lang,
  featured,
}: {
  pkg: FeastPackage;
  lang: "en" | "am";
  featured: boolean;
}) {
  const Icon = ICONS[pkg.icon] ?? Users;
  const saving = packageSaving(pkg);
  const am = lang === "am";

  return (
    <article
      className={[
        "hall-card flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1",
        featured ? "border-gold/50 shadow-[var(--shadow-ember)]" : "",
      ].join(" ")}
    >
      {pkg.image && (
        <img
          src={optimizeImageUrl(pkg.image, 480, 260)}
          alt={pkg.name}
          loading="lazy"
          className="mb-4 h-36 w-full rounded-xl border border-gold/20 object-cover"
        />
      )}
      {featured && (
        <p className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-lit">
          {am ? "ተመራጭ" : "Most ordered"}
        </p>
      )}

      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold leading-tight text-ivory">
            {am ? pkg.nameAm : pkg.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ivory-dim">
            <Users className="h-3 w-3" />
            {am ? `ለ${pkg.serves} ሰው` : `Serves ${pkg.serves}`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
        {am ? pkg.blurbAm : pkg.blurb}
      </p>

      <ul className="mt-4 flex-1 space-y-1.5">
        {(pkg.items ?? []).map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ivory/85">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-gold/20 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-bold text-engraved">
              {formatETB(pkg.price)}
            </p>
            {saving > 0 && (
              <p className="mt-0.5 text-xs text-ivory-dim">
                <span className="line-through">{formatETB(pkg.alaCarte)}</span>
                <span className="ml-1.5 font-semibold text-flag-green">
                  {am ? `${formatETB(saving)} ይቆጥባሉ` : `save ${formatETB(saving)}`}
                </span>
              </p>
            )}
          </div>
          {/* Leads into the EXISTING table-ordering flow — no second ordering system. */}
          <a
            href="/menu"
            className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-ivory transition hover:bg-terracotta-lit"
          >
            {/* Accurate: it opens the existing ordering flow; it does not add
                the package to a cart here (no second ordering system). */}
            {am ? "ይህን ድግስ ይዘዙ" : "Order This Feast"}
          </a>
        </div>
      </div>
    </article>
  );
}

export default function FeastPackagesSection({
  packages: packagesProp,
}: {
  packages?: FeastPackage[];
}) {
  const [lang] = useLang();
  const { packages: fromDb } = useCulturalContent();
  const packages = packagesProp ?? fromDb;
  const [filter, setFilter] = useState<number | "all">("all");
  const am = lang === "am";

  const sizes = useMemo(
    () => Array.from(new Set(packages.map((p) => p.serves))).sort((a, b) => a - b),
    [packages]
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? packages
        : packages.filter((p) => p.serves === filter),
    [filter, packages]
  );

  return (
    <section
      id="feast"
      className="relative overflow-hidden bg-obsidian py-20 sm:py-28"
      aria-labelledby="feast-title"
    >
      <div className="pattern-injera absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow">{am ? "የጋራ ጠረጴዛ" : "Share the table"}</p>
          <h2
            id="feast-title"
            className="mt-3 font-display text-4xl font-bold tracking-tight text-ivory sm:text-5xl"
          >
            {am ? "አብረው ይመገቡ" : "Order the feast, not the dish"}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ivory-dim">
            {am
              ? "በኢትዮጵያ ምግብ በአንድ ሳህን ይቀርባል። ለቡድንዎ ተስማሚውን ጥቅል ይምረጡ — ትዕዛዙ ወዲያውኑ ወደ ኩሽና ይሄዳል።"
              : "Ethiopian food arrives on one platter and is eaten from one platter. Pick the package that fits your table — it goes straight to the kitchen, and nobody spends twenty minutes deciding."}
          </p>
        </div>

        {/* Party-size filter: the decision groups actually make first. */}
        <div
          className="mb-10 flex flex-wrap gap-2"
          role="group"
          aria-label={am ? "በሰው ብዛት አጣራ" : "Filter by party size"}
        >
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              filter === "all"
                ? "border-gold bg-gold/15 text-gold-lit"
                : "border-gold/25 text-ivory-dim hover:border-gold/50 hover:text-ivory",
            ].join(" ")}
          >
            {am ? "ሁሉም" : "All"}
          </button>
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={[
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                filter === s
                  ? "border-gold bg-gold/15 text-gold-lit"
                  : "border-gold/25 text-ivory-dim hover:border-gold/50 hover:text-ivory",
              ].join(" ")}
            >
              {am ? `${s} ሰው` : `${s} guests`}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} lang={lang} featured={pkg.featured} />
          ))}
        </div>

        <div className="mt-12 text-gold/45" aria-hidden="true">
          <TibebBand height={16} />
        </div>

        <p className="mt-6 text-center text-sm text-ivory-dim">
          {am
            ? "የቡድን ድግሶችን፣ የቱር ቡድኖችንና የልደት በዓላትን አስቀድመን እናዘጋጃለን።"
            : "Group feasts, tour buses and birthdays are prepared in advance — call ahead and your platters are plated when you sit down."}{" "}
          <a href={`tel:${RESTAURANT.contact.phone}`} className="font-semibold text-gold hover:text-gold-lit">
            {RESTAURANT.contact.phoneDisplay}
          </a>
        </p>
      </div>
    </section>
  );
}
