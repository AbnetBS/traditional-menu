"use client";

import Link from "next/link";
import { Phone, MapPin, Clock } from "lucide-react";
import { RESTAURANT } from "@/lib/restaurant";
import { useLang } from "@/lib/i18n";
import { MesobMark, TibebBand } from "@/components/cultural/Patterns";

export default function CulturalFooter({ onAdmin }: { onAdmin: () => void }) {
  const [lang] = useLang();
  const am = lang === "am";
  const { identity, contact } = RESTAURANT;

  return (
    <footer className="relative overflow-hidden bg-obsidian pb-10 pt-16">
      <div className="text-gold/40" aria-hidden="true">
        <TibebBand height={18} />
      </div>

      <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand */}
          <div className="flex items-start gap-4">
            <MesobMark size={52} className="text-gold/70" />
            <div>
              <p className="font-display text-xl font-semibold text-ivory">
                {am ? identity.nameAm : identity.name}
              </p>
              <p className="mt-1 text-sm text-ivory-dim">{am ? identity.taglineAm : identity.tagline}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gold/70">
                {identity.shortName} · {am ? "ገርጂ" : "Gerji"}
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2.5 text-sm text-ivory-dim">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gold">
              {am ? "አድራሻ" : "Contact"}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold/70" />
              {am ? contact.addressAm : contact.address}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gold/70" />
              <a href={`tel:${contact.phone}`} className="hover:text-gold">
                {contact.phoneDisplay}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold/70" />
              {am ? contact.hoursNoteAm : contact.hoursNote}
            </p>
          </div>

          {/* Operational links */}
          <div className="space-y-2.5 text-sm text-ivory-dim">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gold">
              {am ? "ለስታፍ" : "For staff"}
            </p>
            <button type="button" onClick={onAdmin} className="block hover:text-gold">
              {am ? "የአስተዳዳሪ ፓነል" : "Owner dashboard"}
            </button>
            <Link href="/waiter" className="block hover:text-gold">
              {am ? "ሰርቨር" : "Waiter"}
            </Link>
            <Link href="/kitchen" className="block hover:text-gold">
              {am ? "ኩሽና" : "Kitchen"}
            </Link>
            <Link href="/barista" className="block hover:text-gold">
              {am ? "ባሪስታ" : "Barista"}
            </Link>
            <Link href="/cashier" className="block hover:text-gold">
              {am ? "ካሺየር" : "Cashier"}
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gold/15 pt-6 text-xs text-ivory-dim sm:flex-row">
          <p>
            © {new Date().getFullYear()} {identity.name} · {am ? "ሁሉም መብቶች የተጠበቁ ናቸው" : "All rights reserved"}
          </p>
          {/* The product credit — this is the part AB Web sells. */}
          <p className="text-center sm:text-right">
            {am ? "የተገነባው በ" : "Powered by"}{" "}
            <span className="font-semibold text-gold">AB Web</span>{" "}
            · {am ? "የኢትዮጵያ ምግብ ቤት OS" : "Ethiopian Restaurant OS"}
          </p>
        </div>
      </div>
    </footer>
  );
}
