"use client";

/**
 * useCulturalContent — the bridge between the owner-controlled database and
 * the customer-facing cultural sections.
 *
 * It fetches `/api/cultural` (experiences / packages / stories) and, for any
 * collection the owner has not populated yet, falls back to the bundled Totot
 * defaults in `@/lib/restaurant`.
 *
 * PERFORMANCE: Tonight / Packages / Story sections each call this hook on the
 * same page. Without coordination that would fire three identical GETs on
 * load. A module-level in-flight promise + short TTL cache collapses those to
 * ONE request; `visibilitychange` refreshes (force) bypass the cache so an
 * owner edit in another tab is still picked up.
 */

import { useCallback, useEffect, useState } from "react";
import {
  RESTAURANT,
  type ExperienceEvent,
  type FeastPackage,
  type DishStory,
} from "@/lib/restaurant";

export interface CulturalContent {
  experiences: ExperienceEvent[];
  packages: FeastPackage[];
  stories: DishStory[];
}

const DEFAULTS: CulturalContent = {
  experiences: RESTAURANT.tonight,
  packages: RESTAURANT.packages,
  stories: RESTAURANT.dishStories,
};

interface ApiShape {
  experiences?: unknown[];
  packages?: unknown[];
  stories?: unknown[];
}

const TTL_MS = 5_000;
let cache: { at: number; content: CulturalContent } | null = null;
let inflight: Promise<ApiShape | null> | null = null;

function merge(data: ApiShape | null): CulturalContent {
  if (!data) return DEFAULTS;
  return {
    experiences:
      Array.isArray(data.experiences) && data.experiences.length > 0
        ? (data.experiences as ExperienceEvent[])
        : DEFAULTS.experiences,
    packages:
      Array.isArray(data.packages) && data.packages.length > 0
        ? (data.packages as FeastPackage[])
        : DEFAULTS.packages,
    stories:
      Array.isArray(data.stories) && data.stories.length > 0
        ? (data.stories as DishStory[])
        : DEFAULTS.stories,
  };
}

async function fetchRaw(): Promise<ApiShape | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/cultural");
      if (!res.ok) return null;
      return (await res.json()) as ApiShape;
    } catch {
      return null; // DB down / offline → caller keeps bundled defaults.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useCulturalContent(): CulturalContent {
  const [content, setContent] = useState<CulturalContent>(
    () => cache?.content ?? DEFAULTS
  );

  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < TTL_MS) {
      setContent(cache.content);
      return;
    }
    const data = await fetchRaw();
    const merged = merge(data);
    cache = { at: Date.now(), content: merged };
    setContent(merged);
  }, []);

  useEffect(() => {
    load();
    // Re-read when the tab becomes visible again (owner may have edited in
    // another tab/device). The SSE push channel is staff-only, so guests use
    // this lightweight visibility refresh instead of a subscription.
    const onVisible = () => {
      if (!document.hidden) load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  return content;
}
