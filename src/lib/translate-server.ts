import { createHash } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { translations } from "@/db/schema";

/**
 * GOOGLE-POWERED AUTO-TRANSLATION (server-side)
 * ─────────────────────────────────────────────
 * Translates owner-managed content (menu items the owner adds, categories,
 * announcements, settings texts) from English to Amharic using Google
 * Translate's public batch endpoint — the same engine as the Google Translate
 * widget, but running SERVER-SIDE:
 *
 *   ✅ no Google script in the browser  → nothing pops up over the menu
 *   ✅ no DOM rewriting by Google       → React/order flow can never break
 *   ✅ works on any host (VPS/Coolify)  → it's a plain server-side fetch
 *
 * Every unique string is translated once, then cached forever in two layers:
 * process memory + the `translations` DB table. Repeat loads are instant,
 * free, and never touch Google again.
 */

const API_BASE = process.env.TRANSLATE_API_BASE || "https://translate.googleapis.com";
const ENDPOINT = `${API_BASE}/translate_a/t`;

/** Target languages the public API may request (extend if more are added). */
export const SUPPORTED_TX_LANGS = new Set(["am"]);

const MAX_TEXT_LEN = 1500; // longer strings are returned untranslated
const MAX_URL_CHARS = 4000; // conservative GET URL budget per chunk
const MAX_TEXTS_PER_CHUNK = 30;
const MAX_CHUNKS_PER_CALL = 6; // ≤ 180 strings per request
const FETCH_TIMEOUT_MS = 9000;
const FALLBACK_GROUP_SIZE = 6; // Google's batch replies are less reliable at scale

/* ─────────── in-process cache (hot path — skips the DB entirely) ─────────── */

const globalForTx = globalThis as typeof globalThis & {
  __restaurantTxMem?: Map<string, string>;
};
const memCache: Map<string, string> = globalForTx.__restaurantTxMem ?? new Map();
globalForTx.__restaurantTxMem = memCache;

const hashText = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 48);

/** Already Amharic / no Latin letters → nothing to translate. */
export function isTranslatable(text: string): boolean {
  if (!text || text.length > MAX_TEXT_LEN) return false;
  if (/[\u1200-\u137F]/.test(text)) return false; // Ge'ez script already
  return /[a-z]/i.test(text); // must contain at least one Latin letter
}

/** Group texts into URL-safe chunks for Google's batch endpoint. */
export function buildChunks(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const text of texts) {
    const encLen = encodeURIComponent(text).length + 3; // "&q="
    if (current.length >= MAX_TEXTS_PER_CHUNK || (current.length > 0 && currentLen + encLen > MAX_URL_CHARS)) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(text);
    currentLen += encLen;
  }
  if (current.length) chunks.push(current);
  return chunks.slice(0, MAX_CHUNKS_PER_CALL);
}

/**
 * Extract [translated, original] segment pairs from ANY Google response shape.
 *
 * The live endpoint returns NESTED segments:
 *   [[["ትርጉም","source",null,null,10], [...], ...], null, "en", ...]
 * Historically it also returned a FLAT segment array:
 *   ["translated","original",null,null,10]
 * (and a rare object variant { source: "translated" }).
 * The old parser only handled the flat shape, so every batched menu string
 * silently stayed English → the user-visible "semi-translation" bug.
 */
export function extractTranslateSegments(data: unknown): Array<[string, string]> {
  const segments: Array<[string, string]> = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): void => {
    if (depth > 5 || node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      // A segment pair: ["translated", "original", ...]
      if (typeof node[0] === "string" && typeof node[1] === "string") {
        segments.push([node[0], node[1]]);
        return;
      }
      for (const child of node) walk(child, depth + 1);
    } else {
      for (const value of Object.values(node as Record<string, unknown>)) walk(value, depth + 1);
    }
  };
  walk(data, 0);
  return segments;
}

/**
 * Parse a Google response against the exact source strings we sent.
 * Returns an array aligned with `sources` (null = could not translate that
 * string) or null when the reply cannot be matched reliably.
 */
export function parseGoogleResponse(data: unknown, sources: string[]): (string | null)[] | null {
  const out: (string | null)[] = new Array(sources.length).fill(null);
  if (sources.length === 0) return out;
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const segments = extractTranslateSegments(data);

  // 1) Rare object variant: { source: "translated", ... } in insertion order.
  if (segments.length === 0 && data && typeof data === "object" && !Array.isArray(data)) {
    const values = Object.values(data as Record<string, unknown>);
    if (values.length === sources.length && values.every((v) => typeof v === "string")) {
      return values.map((v) => (v as string).trim() || null);
    }
    return null;
  }

  // 2) One segment per source → positional mapping (the common case).
  //    Confirm Google echoed the source text back so a reordered/odd reply
  //    can never attach a translation to the wrong dish (normalized compare).
  if (segments.length === sources.length) {
    const mapped: (string | null)[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      const [tx, orig] = segments[i];
      const original = normalize(orig);
      const target = normalize(sources[i]);
      const matches =
        original === target || target.startsWith(original) || original.startsWith(target);
      mapped.push(matches && tx.trim() ? tx.trim() : null);
    }
    return mapped.every(Boolean) ? mapped : null;
  }

  // 3) Segments split per sentence → rebuild each source by matching the
  //    ORIGINAL text Google echoes back (safe: originals are exact).
  if (segments.length > 0) {
    let si = 0;
    let acc = "";
    const accTx: string[] = [];
    for (const [tx, orig] of segments) {
      if (si >= sources.length) return null; // more segments than texts → unmatchable
      const part = normalize(orig);
      acc = acc ? `${acc} ${part}` : part;
      accTx.push(tx.trim());
      const target = normalize(sources[si]);
      if (acc === target) {
        out[si] = accTx.filter(Boolean).join(" ") || null;
        si += 1;
        acc = "";
        accTx.length = 0;
      } else if (!target.startsWith(acc)) {
        return null; // drifted → caller retries in smaller batches
      }
    }
    if (si === sources.length) return out;
    return null;
  }

  return null;
}

/** One HTTP round-trip. Returns null on transport error / bad shapes. */
async function requestTranslate(lang: string, texts: string[]): Promise<(string | null)[] | null> {
  if (texts.length === 0) return [];
  const params = new URLSearchParams({ client: "gtx", sl: "en", tl: lang });
  for (const text of texts) params.append("q", text);
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RestaurantMenuOS/1.0)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return parseGoogleResponse(data, texts);
  } catch {
    return null; // network blocked / timeout / bad shape → caller falls back
  }
}

/**
 * Translate a list of texts with graceful degradation:
 *   1. one big batch (fast path, cached anyway);
 *   2. small groups of ≤ FALLBACK_GROUP_SIZE;
 *   3. one-by-one last resort.
 * Every level fails soft: untranslatable entries stay null → English shown.
 */
async function translateTexts(lang: string, texts: string[]): Promise<(string | null)[]> {
  const batch = await requestTranslate(lang, texts);
  if (batch && batch.every((v) => v)) return batch;

  const groups: string[][] = [];
  for (let i = 0; i < texts.length; i += FALLBACK_GROUP_SIZE) {
    groups.push(texts.slice(i, i + FALLBACK_GROUP_SIZE));
  }
  const result: (string | null)[] = [];
  for (const group of groups) {
    const groupResult = await requestTranslate(lang, group);
    if (groupResult && groupResult.every((v) => v)) {
      result.push(...groupResult);
      continue;
    }
    const singles = await Promise.all(group.map((t) => requestTranslate(lang, [t])));
    group.forEach((_, i) => result.push(singles[i]?.[0] ?? null));
  }
  return result;
}

async function persistToDb(lang: string, pairs: Array<[string, string]>): Promise<void> {
  if (!pairs.length) return;
  try {
    await db
      .insert(translations)
      .values(
        pairs.map(([source, translated]) => ({
          lang,
          sourceHash: hashText(source),
          sourceText: source,
          translatedText: translated,
        }))
      )
      .onConflictDoNothing();
  } catch {
    // cache write failed (rare) — translations still return fine this request
  }
}

/**
 * Translate a batch of unique English strings to `lang`.
 * Returns a map source → translated (missing = could not translate; the
 * caller simply keeps the English original — the site never breaks).
 */
export async function translateBatch(lang: string, input: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!SUPPORTED_TX_LANGS.has(lang)) return result;

  // de-dupe + filter
  const unique = [...new Set(input.map((s) => String(s).trim()).filter(Boolean))];
  const translatable = unique.filter(isTranslatable);
  // pass through anything untranslatable untouched (caller shows original)

  const need: string[] = [];
  for (const text of translatable) {
    const key = `${lang}::${hashText(text)}`;
    const hit = memCache.get(key);
    if (hit) result[text] = hit;
    else need.push(text);
  }
  if (!need.length) return result;

  // 1) DB cache layer
  try {
    const hashes = need.map((t) => hashText(t));
    const rows = await db
      .select({ sourceHash: translations.sourceHash, sourceText: translations.sourceText, translatedText: translations.translatedText })
      .from(translations)
      .where(and(eq(translations.lang, lang), inArray(translations.sourceHash, hashes)));
    const foundTexts = new Set<string>();
    for (const row of rows) {
      result[row.sourceText] = row.translatedText;
      memCache.set(`${lang}::${row.sourceHash}`, row.translatedText);
      foundTexts.add(row.sourceText);
    }
    for (let i = need.length - 1; i >= 0; i--) if (foundTexts.has(need[i])) need.splice(i, 1);
  } catch {
    // DB unavailable → continue with live translation only
  }
  if (!need.length) return result;

  // 2) live Google translation (chunked), then cache
  const fresh: Array<[string, string]> = [];
  const chunks = buildChunks(need);
  const settled = await Promise.all(chunks.map((chunk) => translateTexts(lang, chunk)));
  chunks.forEach((chunk, ci) => {
    const translated = settled[ci];
    if (!translated) return; // chunk failed entirely → keep English for those
    chunk.forEach((source, i) => {
      const value = (translated[i] || "").trim();
      if (!value || value === source) return;
      result[source] = value;
      fresh.push([source, value]);
      memCache.set(`${lang}::${hashText(source)}`, value);
    });
  });
  await persistToDb(lang, fresh);
  return result;
}
