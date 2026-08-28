"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CULTURAL PRIMITIVES
 * ═══════════════════════════════════════════════════════════════════════════
 *  Hand-drawn SVG geometry drawn from real Ethiopian craft: the tibeb border
 *  of a netela, the concentric weave of a mesob, the jebena, the cross.
 *
 *  Everything is inline — no image requests, no license questions, crisp at
 *  any DPR, and recolourable through `currentColor` so it inherits the theme.
 *  Used sparingly: texture and meaning, never decoration for its own sake.
 */

import type { SVGProps } from "react";
import { RESTAURANT } from "@/lib/restaurant";

/* ── Tibeb band ─────────────────────────────────────────────────────────────
   The embroidered border of a netela / habesha kemis. Used as a section
   separator and as the top edge of the QR table card. */
export function TibebBand({
  className = "",
  height = 14,
  ...rest
}: SVGProps<SVGSVGElement> & { height?: number }) {
  return (
    <svg
      viewBox="0 0 128 16"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ height, width: "100%", display: "block" }}
      {...rest}
    >
      <path d="M0 8h128" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      {Array.from({ length: 8 }).map((_, i) => {
        const x = 8 + i * 16;
        return (
          <g key={i}>
            <path
              d={`M${x} 2.5 14.5 8 8 13.5 1.5 8z`}
              transform={`translate(${x - 8} 0)`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.85"
            />
            <path
              d={`M${x + 8} 5v6M${x + 5} 8h6`}
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.6"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── Mesob mark ─────────────────────────────────────────────────────────────
   Concentric woven rings = gathering, sharing, the table as a circle.
   This is the identity mark: it replaces a generic logo placeholder. */
export function MesobMark({
  size = 64,
  className = "",
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.65" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.8" />
      <circle cx="32" cy="32" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {/* The four woven ribs of the basket. */}
      <path
        d="M32 2v60M2 32h60M11 11l42 42M53 11 11 53"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.35"
      />
      {/* Tibeb diamonds on the rim. */}
      {[0, 90, 180, 270].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 32 32)`}>
          <path
            d="M32 6 36 12 32 18 28 12z"
            fill="currentColor"
            opacity="0.9"
          />
        </g>
      ))}
    </svg>
  );
}

/* ── Jebena ─────────────────────────────────────────────────────────────────
   The clay coffee pot. The single most recognisable Ethiopian object; used as
   the icon for the coffee ceremony rather than a generic coffee cup. */
export function Jebena({ size = 40, className = "", ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 56"
      width={size}
      height={(size * 56) / 48}
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {/* neck + lip */}
      <path d="M21 4h6l-1 12c4 3 8 8 8 14v10c0 6-4 10-10 10s-10-4-10-10V30c0-6 4-11 8-14L21 4z" />
      {/* spout */}
      <path d="M34 26c5-2 9-1 11 3" />
      {/* handle */}
      <path d="M14 30c-5 1-7 5-6 9s4 6 7 6" />
      {/* woven band */}
      <path d="M15 34h18" opacity="0.7" />
      <path d="M18 31v6M24 31v6M30 31v6" opacity="0.45" />
      {/* base */}
      <path d="M20 50h8" />
    </svg>
  );
}

/* ── Ethiopic cross motif ───────────────────────────────────────────────────
   Used only as a quiet corner ornament on story cards. */
export function CrossMotif({ size = 28, className = "", ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      {...rest}
    >
      <path d="M16 3v26M3 16h26" />
      <path d="M11 8h10M11 24h10M8 11v10M24 11v10" opacity="0.6" />
      <path d="M16 9 21 16 16 23 11 16z" />
    </svg>
  );
}

/* ── Spice meter ────────────────────────────────────────────────────────────
   Berbere heat is the #1 thing a first-time guest cannot judge from a menu.
   Three peppers, with the Amharic word so it reads in both languages. */
const SPICE_LABELS = {
  0: { en: "Mild", am: "ያልተቀመመ" },
  1: { en: "Gentle heat", am: "ትንሽ ቅመም" },
  2: { en: "Berbere warm", am: "በበርበሬ የተቀመመ" },
  3: { en: "Gurage hot", am: "የጉራጌ ቅመም" },
} as const;

export function SpiceMeter({
  level,
  lang = "en",
  showLabel = true,
  className = "",
}: {
  level: 0 | 1 | 2 | 3;
  lang?: "en" | "am";
  showLabel?: boolean;
  className?: string;
}) {
  const label = SPICE_LABELS[level] ?? SPICE_LABELS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={label.en}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 12 16" width="9" height="12">
            <path
              d="M6 2c2 0 3 1.5 3 4s-1 8-3 8-3-5.5-3-8 1-4 3-4z"
              fill={i < level ? "#C0392B" : "none"}
              stroke={i < level ? "#C0392B" : "rgba(244,235,221,.35)"}
              strokeWidth="1"
            />
            <path
              d="M6 2c0-1.2 1-2 2-2"
              fill="none"
              stroke={i < level ? "#2E7D4F" : "rgba(244,235,221,.35)"}
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        ))}
      </span>
      {showLabel && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ivory-dim">
          {lang === "am" ? label.am : label.en}
        </span>
      )}
      <span className="sr-only">
        {label.en} — spice level {level} of 3
      </span>
    </span>
  );
}

/* ── Dish badges ────────────────────────────────────────────────────────────
   Raw / fasting / vegetarian. "Raw" is not a warning, it is information —
   kitfo is served three ways and guests need to choose knowingly. */
export function DishFlag({
  kind,
  lang = "en",
}: {
  kind: "raw" | "fasting" | "vegetarian";
  lang?: "en" | "am";
}) {
  const map = {
    raw: {
      en: "Served raw",
      am: "በጥሬ ይቀርባል",
      color: "#C0392B",
      hint: "Ask for leb leb (warmed) or fully cooked if you prefer",
    },
    fasting: {
      en: "Fasting food",
      am: "የጾም ምግብ",
      color: "#2E7D4F",
      hint: "No animal product — safe for Orthodox fasting days",
    },
    vegetarian: {
      en: "Vegetarian",
      am: "የአትክልት",
      color: "#2E7D4F",
      hint: "No meat or fish",
    },
  } as const;
  const c = map[kind];
  return (
    <span
      title={c.hint}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: c.color, borderColor: `${c.color}55`, background: `${c.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {lang === "am" ? c.am : c.en}
    </span>
  );
}

/* ── National colours, as an accent only ────────────────────────────────────
   A 3-pixel woven ribbon. This is the ONLY place the flag palette appears in
   the whole product — that restraint is what keeps the design premium. */
export function FlagRibbon({ className = "" }: { className?: string }) {
  const { flag } = RESTAURANT.tokens;
  return (
    <span className={`flex overflow-hidden rounded-full ${className}`} aria-hidden="true">
      <span className="h-[3px] w-6" style={{ background: flag.green }} />
      <span className="h-[3px] w-6" style={{ background: flag.yellow }} />
      <span className="h-[3px] w-6" style={{ background: flag.red }} />
    </span>
  );
}
