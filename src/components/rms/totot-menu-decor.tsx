"use client";

import type { SVGProps } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CUSTOMER MENU ORNAMENTS — "carved mesob" language
 * ═══════════════════════════════════════════════════════════════════════════
 *  Tiny SVG motifs inspired by carved Ethiopian wood panels and woven mesob
 *  basketry: gold hairlines, diamond lattice, dotted borders, corner carvings.
 *  Pure CSS/SVG — zero image requests, crisp at any DPR, recolorable via
 *  `currentColor`. Used ONLY by the customer QR menu (src/components/rms).
 */

/** A single carved corner (an L-shaped double line with a diamond). */
export function FrameCorner({ className = "", ...rest }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true" {...rest}>
      <path d="M2 38V11Q2 2 11 2h27" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M8.5 38V14.5Q8.5 8.5 14.5 8.5H38" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path d="M10 24l7-9 7 9-7 9z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="17" cy="15" r="1.7" fill="currentColor" />
    </svg>
  );
}

/** Four carved corners — place inside a `position:relative` parent. */
export function FrameCorners({ className = "" }: { className?: string }) {
  const base = `tm-corner ${className}`;
  return (
    <>
      <FrameCorner className={`${base} tm-corner-tl`} />
      <FrameCorner className={`${base} tm-corner-tr`} />
      <FrameCorner className={`${base} tm-corner-br`} />
      <FrameCorner className={`${base} tm-corner-bl`} />
    </>
  );
}

/** Ornamental divider: gold hairline — woven diamond — hairline. */
export function OrnamentDivider({ className = "", tone = "gold" }: { className?: string; tone?: "gold" | "dark" }) {
  return (
    <div className={`tm-divider ${tone === "dark" ? "tm-divider-dark" : ""} ${className}`} aria-hidden="true">
      <span className="tm-divider-line" />
      <svg viewBox="0 0 64 12" fill="none" className="tm-divider-motif">
        <path d="M32 1.5 38.5 6 32 10.5 25.5 6z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="12" cy="6" r="1.6" fill="currentColor" opacity="0.8" />
        <circle cx="52" cy="6" r="1.6" fill="currentColor" opacity="0.8" />
        <path d="M17 6h5M42 6h5" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
      </svg>
      <span className="tm-divider-line" />
    </div>
  );
}

/** The Totot logo set in a woven mesob ring — used in the menu header. */
export function MesobSeal({ src, alt, size = 44 }: { src: string; alt: string; size?: number }) {
  return (
    <span className="tm-seal" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="tm-seal-ring" aria-hidden="true">
        {[...Array(24)].map((_, i) => (
          <line
            key={i}
            x1="24"
            y1="1.5"
            x2="24"
            y2="6"
            stroke="currentColor"
            strokeWidth="2"
            transform={`rotate(${i * 15} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
        <path d="M9 24a15 15 0 0 1 30 0" fill="none" stroke="#9A4E32" strokeWidth="1.2" opacity="0.55" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="tm-seal-img" />
    </span>
  );
}

/** Small jebena / coffee-ceremony motif used beside section eyebrows. */
export function JebenaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 2c-1 2 1 2.6 0 4.5M10.5 1.5c-1 2 1 2.6 0 4.5M14 2c-1 2 1 2.6 0 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 10h8l-1.2 9.4a2.4 2.4 0 0 1-2.4 2.1h-.8a2.4 2.4 0 0 1-2.4-2.1Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 12h2a2.4 2.4 0 0 1 0 4.8h-2.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
