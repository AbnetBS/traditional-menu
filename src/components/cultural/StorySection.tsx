"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE STORY BEHIND THE FOOD  ·  የምግቡ ታሪክ
 * ═══════════════════════════════════════════════════════════════════════════
 *  Most of Totot's hesitation to order is not price — it is not knowing what
 *  kitfo is, whether it is raw, or how hot "berbere" is. A guest who
 *  understands a dish orders it. A guest who does not, orders injera and a
 *  soft drink and leaves money on the table.
 *
 *  So every dish carries a region, a two-sentence story, a spice meter, a
 *  raw/fasting flag and "how to eat it". Not a history lesson — just enough
 *  to make the choice feel safe.
 *
 *  The name origin is real and documented: "Totot" is Gurage for "let's work".
 *  That is a story, not decoration, and it is worth more than any pattern.
 */

import { useState } from "react";
import { ChevronDown, MapPin, Flame } from "lucide-react";
import { RESTAURANT, type DishStory } from "@/lib/restaurant";
import { useCulturalContent } from "@/lib/use-cultural";
import { useLang } from "@/lib/i18n";
import { optimizeImageUrl } from "@/lib/image-utils";
import {
  CrossMotif,
  SpiceMeter,
  DishFlag,
  MesobMark,
} from "@/components/cultural/Patterns";

function DishCard({ story, lang }: { story: DishStory; lang: "en" | "am" }) {
  const [open, setOpen] = useState(false);
  const am = lang === "am";
  const pairs = story.pairsWith ?? [];

  return (
    <article className="hall-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full p-5 text-left transition hover:bg-gold/5"
      >
        {story.image && (
          <img
            src={optimizeImageUrl(story.image, 480, 260)}
            alt={story.dish}
            loading="lazy"
            className="mb-4 h-36 w-full rounded-xl border border-gold/20 object-cover"
          />
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold">
              <CrossMotif size={16} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                {am ? story.regionAm : story.region}
              </span>
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-ivory">
              {story.dish}
            </h3>
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-gold transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SpiceMeter level={story.spice} lang={lang} />
          {story.raw && <DishFlag kind="raw" lang={lang} />}
          {story.fasting && <DishFlag kind="fasting" lang={lang} />}
          {!story.fasting && story.vegetarian && <DishFlag kind="vegetarian" lang={lang} />}
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ivory-dim">
          {am ? story.storyAm : story.story}
        </p>
      </button>

      {open && (
        <div className="animate-hall-fade border-t border-gold/20 px-5 py-5">
          <p className="text-sm leading-relaxed text-ivory/90">
            {am ? story.storyAm : story.story}
          </p>

          {/* The single most useful block on the page for a first-time guest. */}
          <div className="mt-5 rounded-xl border border-gold/25 bg-gold/8 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-lit">
              <Flame className="h-3.5 w-3.5" />
              {am ? "እንዴት ይበላል" : "How to eat it"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ivory/90">
              {am ? story.howToEatAm : story.howToEat}
            </p>
          </div>

          {pairs.length > 0 && (
            <p className="mt-4 text-sm text-ivory-dim">
              <span className="font-semibold text-ivory">
                {am ? "ከእነዚህ ጋር ይስማማል፦ " : "Goes with: "}
              </span>
              {pairs.join(" · ")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function StorySection({ stories: storiesProp }: { stories?: DishStory[] }) {
  const [lang] = useLang();
  const am = lang === "am";
  const { identity } = RESTAURANT;
  const { stories: fromDb } = useCulturalContent();
  const stories = storiesProp ?? fromDb;

  return (
    <section
      id="story"
      className="relative overflow-hidden bg-night py-20 sm:py-28"
      aria-labelledby="story-title"
    >
      <div className="pattern-weave absolute inset-0 opacity-70" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── The name ───────────────────────────────────────────────────── */}
        <div className="mb-16 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="eyebrow">{am ? "ስሙ ከየት መጣ" : "Where the name comes from"}</p>
            <h2
              id="story-title"
              className="mt-3 font-display text-4xl font-bold tracking-tight text-ivory sm:text-5xl"
            >
              {am ? "«ቶቶት» ማለት «እንስራ»" : "“Totot” means “let's work”"}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ivory-dim">
              {am ? identity.nameOrigin.textAm : identity.nameOrigin.text}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ivory/90">
              {am ? identity.storyAm : identity.story}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 text-gold/70">
            <MesobMark size={168} className="animate-weave" />
            <p className="text-center text-xs uppercase tracking-[0.22em] text-ivory-dim">
              {am ? "መሶብ — የጋራ ጠረጴዛ" : "The mesob — a table for everyone"}
            </p>
          </div>
        </div>

        {/* ── Dish stories ───────────────────────────────────────────────── */}
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h3 className="font-display text-2xl font-semibold text-ivory sm:text-3xl">
            {am ? "ምን እንደሚመገቡ ይረዱ" : "Know what you're ordering"}
          </h3>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-ivory-dim sm:inline">
            {am ? "ለመክፈት ይንኩ" : "Tap a dish to open it"}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {stories.map((s) => (
            <DishCard key={s.dish} story={s} lang={lang} />
          ))}
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-ivory-dim">
          <MapPin className="h-4 w-4 text-gold" />
          {am
            ? "ምግቦቻችን ከደቡብ ኢትዮጵያ ባህል የመጡ ናቸው።"
            : "Every dish here comes from a specific place in Ethiopia — ask your waiter where."}
        </p>
      </div>
    </section>
  );
}
