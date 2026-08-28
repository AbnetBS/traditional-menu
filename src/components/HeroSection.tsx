"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  HERO — "WELCOME TO THE TABLE"
 * ═══════════════════════════════════════════════════════════════════════════
 *  The first screen is not "Welcome, view our menu". It is an invitation to a
 *  table. The Amharic line leads — ወደ ህላዊ ዕም እንን በደህና መጡ — with the
 *  English beneath it, because this venue reads Amharic-first to a local and
 *  is a postcard to a tourist. Either way, one verb: "Explore the Feast".
 *
 *  The composition is deliberately a hall at night, not a café: mesob platter
 *  imagery, jebena, lantern light, and a single warm accent (terracotta).
 */

import { Utensils, Calendar, ChevronRight, Star, Clock, Music } from "lucide-react";
import { RESTAURANT, isOpenNow } from "@/lib/restaurant";
import { useLang } from "@/lib/i18n";
import { TibebBand, FlagRibbon } from "@/components/cultural/Patterns";

interface HeroProps {
  onOpenMenu: () => void;
  onOpenSection: (id: string) => void;
}

export default function HeroSection({ onOpenMenu, onOpenSection }: HeroProps) {
  const [lang] = useLang();
  const am = lang === "am";
  const { identity, contact } = RESTAURANT;

  const rating = contact.googleRating;
  const reviewCount = contact.googleReviewCount;

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-obsidian"
    >
      {/* ── Background: the hall itself ─────────────────────────────────── */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/images/hero-hall.jpg"
          alt=""
          className="h-full w-full object-cover object-center opacity-60"
        />
        {/* Warm scrim so the type always sits on darkness. */}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-night/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-night/80 via-transparent to-night/40" />
      </div>

      {/* A single ember of light, bottom-left, like a coal brazier. */}
      <div
        className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-terracotta/20 blur-[120px] animate-ambient-pulse"
        aria-hidden="true"
      />

      {/* Top tibeb edge — the embroidered border frames the whole hall. */}
      <div className="absolute inset-x-0 top-0 z-10 text-gold/55" aria-hidden="true">
        <TibebBand />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {/* Live status + location strip */}
          <div className="animate-hall-fade mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-night/60 px-3.5 py-1.5 font-semibold text-ivory backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                {isOpenNow() && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flag-green opacity-70" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-flag-green" />
              </span>
              {am ? contact.hoursNoteAm : contact.hoursNote}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ivory-dim">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              <span className="font-semibold text-ivory">{rating}</span>
              <span>({reviewCount} {am ? "ግምገማዎች" : "reviews"})</span>
            </span>
            <span className="hidden sm:inline text-ivory-dim">·</span>
            <span className="hidden sm:inline text-ivory-dim">{am ? contact.addressAm : contact.address}</span>
          </div>

          {/* The Amharic line leads. */}
          <p
            className="animate-hall-fade text-2xl leading-relaxed text-gold-lit sm:text-3xl"
            style={{ animationDelay: "80ms" }}
          >
            {am ? identity.nameAm : "ወደ ባህላዊ ጣዕም እንኳን በደህና መጡ"}
          </p>

          <h1
            className="animate-hall-fade mt-3 font-display text-5xl font-bold leading-[1.05] tracking-tight text-ivory sm:text-7xl"
            style={{ animationDelay: "140ms" }}
          >
            {am
              ? "Welcome to the Table"
              : "Welcome to the Table"}
          </h1>

          <p
            className="animate-hall-fade mt-5 max-w-xl text-base leading-relaxed text-ivory-dim sm:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            {am ? identity.taglineAm : identity.tagline}
          </p>

          {/* Primary + secondary actions */}
          <div
            className="animate-hall-fade mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "260ms" }}
          >
            <button
              type="button"
              onClick={onOpenMenu}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-8 py-4 text-sm font-bold uppercase tracking-wider text-ivory shadow-[var(--shadow-ember)] transition hover:bg-terracotta-lit hover:scale-[1.02]"
            >
              <Utensils className="h-4 w-4" />
              {am ? "ድግሱን ያስሱ" : "Explore the Feast"}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSection("tonight")}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-night/50 px-8 py-4 text-sm font-bold uppercase tracking-wider text-gold backdrop-blur-sm transition hover:border-gold hover:text-gold-lit"
            >
              <Music className="h-4 w-4" />
              {am ? "ዛሬ ሽት" : "Tonight"}
            </button>
          </div>

          {/* Section shortcuts: Menu | Experience | Tonight | Our Story */}
          <nav
            aria-label="Primary"
            className="animate-hall-fade mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ivory-dim"
            style={{ animationDelay: "320ms" }}
          >
            {[
              { id: "menu", en: "Menu", am: "ምናሌ" },
              { id: "feast", en: "Experience", am: "ተሞክሮ" },
              { id: "tonight", en: "Tonight", am: "ዛሬ ሽት" },
              { id: "story", en: "Our Story", am: "ታሪካችን" },
            ].map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenSection(s.id)}
                className="group inline-flex items-center gap-2 transition hover:text-gold"
              >
                {i > 0 && <span className="text-gold/40">/</span>}
                <span className="underline-offset-4 group-hover:underline">{am ? s.am : s.en}</span>
              </button>
            ))}
          </nav>

          {/* Identity row: name + etymology + the flag ribbon (the only one). */}
          <div
            className="animate-hall-fade mt-12 flex flex-wrap items-center gap-4 text-xs text-ivory-dim"
            style={{ animationDelay: "380ms" }}
          >
            <FlagRibbon />
            <span className="font-semibold tracking-[0.2em] uppercase text-ivory">
              {identity.shortName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{am ? identity.nameOrigin.textAm : identity.nameOrigin.text}</span>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <button
        type="button"
        onClick={() => onOpenSection("menu")}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-gold/70 transition hover:text-gold"
        aria-label={am ? "ወደ ናሌ ሸብልሉ" : "Scroll to the menu"}
      >
        <span className="block h-10 w-6 rounded-full border border-gold/40 p-1">
          <span className="mx-auto block h-2 w-1 animate-bounce rounded-full bg-gold/70" />
        </span>
      </button>

      {/* Clock in the corner — Totot never sleeps, and neither does the guest. */}
      <div className="absolute right-4 top-6 z-10 hidden items-center gap-2 text-xs text-ivory-dim sm:flex">
        <Clock className="h-3.5 w-3.5 text-gold" />
        <span>{am ? contact.hoursNoteAm : contact.hoursNote}</span>
      </div>

      {/* Reserve anchor target lives on the next section; this stays here. */}
      <div id="reserve" className="sr-only" />
    </section>
  );
}
