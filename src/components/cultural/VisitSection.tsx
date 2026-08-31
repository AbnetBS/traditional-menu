"use client";

/**
 *  VISIT — address, hours, phone, and a live map, all in the dark theme.
 *  Totot is easy to find on a map and hard to find from a street, so the
 *  plus-code is given the same prominence as the address.
 */

import { MapPin, Phone, Clock, Globe, Navigation } from "lucide-react";
import { RESTAURANT } from "@/lib/restaurant";
import { useLang } from "@/lib/i18n";
import { TibebBand } from "@/components/cultural/Patterns";

export default function VisitSection() {
  const [lang] = useLang();
  const am = lang === "am";
  const { contact, identity } = RESTAURANT;

  // Official Google Maps listing (client-approved). The embed uses the plus
  // code so the iframe is stable; the “Get directions” button goes to the
  // official listing URL.
  const mapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${contact.plusCode}`
  )}&z=17&output=embed`;
  const mapsLink = contact.social.mapsUrl;

  return (
    <section id="visit" className="relative overflow-hidden bg-night py-20 sm:py-28">
      <div className="absolute inset-x-0 top-0 text-gold/40" aria-hidden="true">
        <TibebBand />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow">{am ? "ይጎብኙን" : "Visit the hall"}</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ivory sm:text-5xl">
            {am ? "ገር አዲስ አበባ" : "Gerji, Addis Ababa"}
          </h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Details */}
          <div className="space-y-4">
            <div className="hall-card flex items-start gap-4 p-5">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold text-ivory">{am ? "አድራሻ" : "Address"}</p>
                <p className="mt-1 text-sm leading-relaxed text-ivory-dim">
                  {am ? contact.addressAm : contact.address}
                </p>
              </div>
            </div>

            <div className="hall-card flex items-start gap-4 p-5">
              <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold text-ivory">{am ? "የካርታ ኮ" : "Plus code"}</p>
                <p className="mt-1 font-mono text-sm text-ivory-dim">{contact.plusCode}</p>
              </div>
            </div>

            <div className="hall-card flex items-start gap-4 p-5">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold text-ivory">{am ? "የስራ ሰዓት" : "Hours"}</p>
                <p className="mt-1 text-sm text-ivory-dim">
                  {am ? contact.hoursNoteAm : contact.hoursNote}
                </p>
              </div>
            </div>

            <div className="hall-card flex items-start gap-4 p-5">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold text-ivory">{am ? "ስልክ" : "Phone"}</p>
                <a href={`tel:${contact.phone}`} className="mt-1 block text-sm font-semibold text-gold hover:text-gold-lit">
                  {contact.phoneDisplay}
                </a>
              </div>
            </div>

            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 text-sm font-bold text-ivory transition hover:bg-terracotta-lit"
            >
              <Globe className="h-4 w-4" />
              {am ? "አቅጣጫ ያግኙ" : "Get directions"}
            </a>
          </div>

          {/* Map */}
          <div className="hall-card overflow-hidden">
            <iframe
              title={am ? "የቶቶት ርታ" : "Map to Totot"}
              src={mapsEmbed}
              className="h-full min-h-[320px] w-full grayscale-[35%] contrast-[1.05]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
