"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE MENU — dark, photographic, and honest about spice
 * ═══════════════════════════════════════════════════════════════════════════
 *  This is the browse face of the menu on the public site. Every dish shows a
 *  photo, the Amharic name, a price, and — the part a tourist needs — a spice
 *  meter and raw/fasting flags. Ordering itself happens on the QR page
 *  (/menu?table=N); this section just makes you hungry and confident.
 */

import { useMemo, useState } from "react";
import { ArrowRight, Flame, Utensils } from "lucide-react";
import { MenuItem, Category } from "@/types";
import { dishStoryFor } from "@/lib/restaurant";
import { useLang } from "@/lib/i18n";
import { SpiceMeter, DishFlag } from "@/components/cultural/Patterns";

function DishCard({ item, lang, onOpen }: { item: MenuItem; lang: "en" | "am"; onOpen: () => void }) {
  const story = dishStoryFor(item.name);
  const am = lang === "am";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hall-card group overflow-hidden text-left transition duration-300 hover:-translate-y-1"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-transparent to-transparent" />
        {item.isPopular && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ivory">
            <Flame className="h-3 w-3" />
            {am ? "ታቂ" : "Popular tonight"}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-tight text-ivory">
            {item.name}
          </h3>
          <span className="shrink-0 font-display text-lg font-bold text-engraved">
            {item.price.toLocaleString("en-US")}
          </span>
        </div>

        {/* Spice + flags — the information that turns hesitation into an order. */}
        {story && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <SpiceMeter level={story.spice} lang={lang} showLabel={false} />
            {story.raw && <DishFlag kind="raw" lang={lang} />}
            {story.fasting && <DishFlag kind="fasting" lang={lang} />}
          </div>
        )}

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ivory-dim">
          {item.description}
        </p>
      </div>
    </button>
  );
}

export default function CulturalMenuSection({
  items,
  categories,
  onOrder,
}: {
  items: MenuItem[];
  categories: Category[];
  onOrder: () => void;
}) {
  const [lang] = useLang();
  const [cat, setCat] = useState("all");
  const am = lang === "am";

  const visible = useMemo(
    () => (cat === "all" ? items : items.filter((i) => i.category === cat)),
    [items, cat]
  );

  const realCategories = useMemo(
    () => categories.filter((c) => c.slug !== "all"),
    [categories]
  );

  return (
    <section
      id="menu"
      className="relative overflow-hidden bg-obsidian py-20 sm:py-28"
      aria-labelledby="menu-title"
    >
      <div className="pattern-weave absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow">{am ? "የቶቶት ምናሌ" : "The menu"}</p>
            <h2 id="menu-title" className="mt-3 font-display text-4xl font-bold tracking-tight text-ivory sm:text-5xl">
              {am ? "ከኩሽናው" : "From the kitchen"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOrder}
            className="group inline-flex items-center gap-2 rounded-full border border-gold/40 px-6 py-3 text-sm font-bold text-gold transition hover:border-gold hover:text-gold-lit"
          >
            <Utensils className="h-4 w-4" />
            {am ? "ከጠረጴዛዎ ይዙ" : "Order from your table"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {realCategories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <button
              type="button"
              onClick={() => setCat("all")}
              aria-pressed={cat === "all"}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                cat === "all"
                  ? "border-gold bg-gold/15 text-gold-lit"
                  : "border-gold/25 text-ivory-dim hover:border-gold/50 hover:text-ivory"
              }`}
            >
              {am ? "ሁሉም" : "All"}
            </button>
            {realCategories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCat(c.slug)}
                aria-pressed={cat === c.slug}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  cat === c.slug
                    ? "border-gold bg-gold/15 text-gold-lit"
                    : "border-gold/25 text-ivory-dim hover:border-gold/50 hover:text-ivory"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="hall-card grid place-items-center p-14 text-center text-ivory-dim">
            <p>{am ? "ምናሌው በቅርቡ ይመጣል።" : "The kitchen is loading its dishes — come back in a moment."}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.slice(0, 9).map((item) => (
              <DishCard key={item.id} item={item} lang={lang} onOpen={onOrder} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={onOrder}
            className="rounded-full bg-terracotta px-8 py-4 text-sm font-bold uppercase tracking-wider text-ivory transition hover:bg-terracotta-lit"
          >
            {am ? "ሙሉ ምናሌውን ይመልከቱ" : "Open the full menu & order"}
          </button>
        </div>
      </div>
    </section>
  );
}
