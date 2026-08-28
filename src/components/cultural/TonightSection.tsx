"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TONIGHT AT TOTOT  ·  ዛሬ ምሽት በቶቶት
 * ═══════════════════════════════════════════════════════════════════════════
 *  Totot does not sell dinner. It sells an evening: food + live band +
 *  dancing + coffee ceremony, in a hall that is loudest exactly when service
 *  is hardest.
 *
 *  So the programme becomes a first-class part of the product. Guests plan
 *  around it, and the same schedule is what the QR menu shows at the top of
 *  the screen ("the dance starts in 12 minutes — order before it does").
 *
 *  It is computed from the clock, not hardcoded: `useEffect` seeds the time on
 *  the client so server and client agree, and a one-minute tick keeps "Now
 *  performing" honest without a network call.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Music,
  Sparkles,
  Coffee,
  Utensils,
  Flame,
  Clock,
  Users,
  ChevronRight,
} from "lucide-react";
import { RESTAURANT, type ExperienceEvent } from "@/lib/restaurant";
import { useCulturalContent } from "@/lib/use-cultural";
import { useLang } from "@/lib/i18n";
import { optimizeImageUrl } from "@/lib/image-utils";
import { TibebBand, Jebena } from "@/components/cultural/Patterns";

const ICONS: Record<string, typeof Music> = {
  Music,
  Sparkles,
  Coffee,
  Utensils,
  Flame,
};

/** "19:45" → minutes since midnight. Returns null on anything unparseable. */
function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesUntil(time: string, nowMin: number): number | null {
  const target = toMinutes(time);
  if (target === null) return null;
  let diff = target - nowMin;
  if (diff < -120) diff += 24 * 60; // wraps past midnight (the hall is open 24h)
  return diff;
}

export function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

type EventState = {
  event: ExperienceEvent;
  /** "live" | "next" | "later" */
  state: "live" | "next" | "later";
  /** Minutes from now until it starts (negative once running). */
  startsIn: number | null;
};

/** Derives the programme state for a given clock reading. Pure → testable. */
export function buildTonight(events: ExperienceEvent[], now: Date): EventState[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const decorated: EventState[] = events
    .map((event): EventState => {
      const startsIn = minutesUntil(event.time, nowMin);
      const start = toMinutes(event.time);
      let state: EventState["state"] = "later";
      if (startsIn !== null && start !== null) {
        if (startsIn <= 0 && -startsIn < event.durationMin) state = "live";
      }
      return { event, state, startsIn };
    })
    // Owner-created rows may omit `activeTonight` (they use `active`, already
    // filtered by the public API) — treat "not explicitly off" as on.
    .filter((d) => d.event.activeTonight !== false);

  // Promote exactly one event to "next": the soonest one that has not started.
  const upcoming = decorated
    .filter((d) => d.state !== "live" && (d.startsIn ?? Infinity) > 0)
    .sort((a, b) => (a.startsIn ?? 0) - (b.startsIn ?? 0));
  if (upcoming.length > 0) upcoming[0].state = "next";

  return decorated;
}

function countdownText(startsIn: number, lang: "en" | "am"): string {
  if (startsIn <= 0) return lang === "am" ? "አሁን እየተካሄደ ነው" : "Happening now";
  if (startsIn < 60) return lang === "am" ? `በ${startsIn} ደቂቃ` : `in ${startsIn} min`;
  const h = Math.floor(startsIn / 60);
  return lang === "am" ? `በ${h} ሰዓት` : `in ${h}h`;
}

export default function TonightSection({
  experiences: experiencesProp,
}: {
  /** When supplied (admin preview) use these instead of the DB/hook. */
  experiences?: ExperienceEvent[];
}) {
  const [lang] = useLang();
  const { experiences: fromDb } = useCulturalContent();
  const experiences = experiencesProp ?? fromDb;
  const [now, setNow] = useState<Date | null>(null);

  // Read the clock only after mount: the server has no idea what a guest's
  // local time is, and rendering "now" server-side would flicker on hydrate.
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const programme = useMemo(
    () => (now ? buildTonight(experiences, now) : []),
    [now, experiences]
  );
  const live = programme.find((p) => p.state === "live") ?? null;
  const next = programme.find((p) => p.state === "next") ?? null;

  const am = lang === "am";

  return (
    <section
      id="tonight"
      className="relative overflow-hidden bg-night py-20 sm:py-28"
      aria-labelledby="tonight-title"
    >
      {/* Woven texture + a single warm light source, like lamps in the hall. */}
      <div className="pattern-mesob absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-terracotta/12 blur-[110px] animate-ambient-pulse"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-0 text-gold/50" aria-hidden="true">
        <TibebBand />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-14 text-center">
          <p className="eyebrow">{am ? "የዛሬ ምሽት መርሐ ግብር" : "Tonight's programme"}</p>
          <h2
            id="tonight-title"
            className="mt-3 font-display text-4xl font-bold tracking-tight text-ivory sm:text-5xl"
          >
            {am ? "ዛሬ ምሽት በቶቶት" : "Tonight at Totot"}
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base text-ivory-dim">
            {am
              ? "ምግቡ አንዱ ክፍል ብቻ ነው። ባንዱ፣ ውዝዋዜውና የቡና ስነ-ስርዓቱ ምሽቱን ይሠራሉ።"
              : "The food is one part of it. The band, the dancing and the coffee ceremony are what make the evening."}
          </p>
        </div>

        {/* ── Now / Next strip ───────────────────────────────────────────── */}
        {now && (live || next) && (
          <div className="mb-12 grid gap-4 sm:grid-cols-2">
            {live && (
              <div className="ember-card relative overflow-hidden p-6">
                <div className="flex items-start gap-4">
                  <span className="animate-live mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-flag-red" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-flag-red">
                      {am ? "አሁን በመድረክ ላይ" : "Now on stage"}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-ivory">
                      {am ? live.event.titleAm : live.event.title}
                    </p>
                    <p className="mt-2 text-sm text-ivory-dim">
                      {am ? live.event.descriptionAm : live.event.description}
                    </p>
                    {live.event.participatory && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-lit">
                        <Users className="h-3.5 w-3.5" />
                        {am ? "ጠረጴዛዎን ወደ መድረክ ይጋብዛሉ" : "They will invite your table up"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {next && (
              <div className="hall-card p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                  {am ? "ቀጥሎ" : "Up next"}
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-3xl font-bold text-engraved">
                    {next.event.time}
                  </span>
                  <span className="text-sm text-ivory-dim">
                    {next.startsIn !== null ? countdownText(next.startsIn, am ? "am" : "en") : ""}
                  </span>
                </div>
                <p className="mt-1 font-display text-xl font-semibold text-ivory">
                  {am ? next.event.titleAm : next.event.title}
                </p>
                <p className="mt-2 text-sm text-ivory-dim">
                  {am
                    ? "ከዚያ በፊት ይዘዙ — በዝግጅቱ ወቅት አገልግሎቱ ይዘገያል።"
                    : "Order before it starts — service slows down during the show."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        {programme.length > 0 ? (
          <ol className="relative space-y-0 border-l border-gold/25 pl-6 sm:pl-10">
            {programme.map(({ event, state, startsIn }) => {
              const Icon = ICONS[event.icon] ?? Utensils;
              const isLive = state === "live";
              const isNext = state === "next";
              return (
                <li key={event.id} className="relative pb-8 last:pb-0">
                  {/* node */}
                  <span
                    className={[
                      "absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border sm:-left-[47px]",
                      isLive
                        ? "border-flag-red bg-flag-red"
                        : isNext
                        ? "border-gold bg-obsidian"
                        : "border-gold/40 bg-obsidian",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isNext && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                  </span>

                  <div
                    className={[
                      "hall-card p-5 transition-colors",
                      isLive ? "border-flag-red/40" : isNext ? "border-gold/45" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          isLive
                            ? "border-flag-red/40 bg-flag-red/15 text-flag-red"
                            : "border-gold/30 bg-gold/10 text-gold",
                        ].join(" ")}
                      >
                        {event.kind === "coffee" ? (
                          <Jebena size={22} />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        {event.image && (
                          <img
                            src={optimizeImageUrl(event.image, 240, 140)}
                            alt=""
                            loading="lazy"
                            className="mb-3 h-24 w-full rounded-xl border border-gold/20 object-cover"
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-display text-lg font-semibold text-ivory">
                            {event.time}
                          </span>
                          <h3 className="font-display text-lg font-semibold text-ivory">
                            {am ? event.titleAm : event.title}
                          </h3>
                          {isLive && (
                            <span className="rounded-full bg-flag-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-flag-red">
                              {am ? "በቀጥታ" : "Live"}
                            </span>
                          )}
                          {isNext && startsIn !== null && (
                            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-lit">
                              {countdownText(startsIn, am ? "am" : "en")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ivory-dim">
                          {am ? event.descriptionAm : event.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          /* Skeleton while the clock resolves — never an empty box. */
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hall-card h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Business-purpose CTA: convert the programme into orders ────── */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-2 text-sm text-ivory-dim">
            <Clock className="h-4 w-4 text-gold" />
            {now ? `${hhmm(now)} · ` : ""}
            {next
              ? am
                ? `ትርኢቱ በ${next.event.time} ይጀምራል — ከዚያ በፊት ይዘ።`
                : `The show starts at ${next.event.time} — order before it begins.`
              : am
              ? RESTAURANT.contact.hoursNoteAm
              : RESTAURANT.contact.hoursNote}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/menu"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 text-sm font-bold text-ivory transition hover:bg-terracotta-lit"
            >
              <Utensils className="h-4 w-4" />
              {am ? "ለጠረጴዛው ይዘዙ" : "Order for the Table"}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#reserve"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 px-6 py-3 text-sm font-bold text-gold transition hover:border-gold hover:text-gold-lit"
            >
              {am ? "ምሽትዎን ያቅ" : "Plan your evening"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
