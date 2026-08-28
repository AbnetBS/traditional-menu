"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  🔥 RUSH MODE — the owner's busy-night command center
 * ═══════════════════════════════════════════════════════════════════════════
 *  Answers ONE question: "Where should I intervene right now?"
 *
 *  Data comes from the server-aggregated /api/rush (admin-only). Refreshes are
 *  event-driven via the existing SSE `orders` channel (any order / station /
 *  service-call change pushes), PLUS a 30s tick because *age* advances with
 *  clock time even when nothing changes. No heavy polling, no full history in
 *  the browser.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Flame, Users, Utensils, Coffee, BellRing, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { RushSnapshot, StationStats } from "@/lib/rush";

const TICK_MS = 30_000;

function ageLabel(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4 text-center">
      <p className={`font-serif text-3xl font-black ${tone === "bad" ? "text-rose-400" : tone === "warn" ? "text-amber-300" : "text-amber-100"}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
    </div>
  );
}

function Station({ title, icon, s, prepMin }: { title: string; icon: ReactNode; s: StationStats; prepMin: number }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-100">
        {icon} {title}
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div><p className="text-xl font-black text-amber-100">{s.active}</p><p className="text-[10px] text-stone-400">cooking</p></div>
        <div><p className="text-xl font-black text-amber-100">{s.waiting}</p><p className="text-[10px] text-stone-400">waiting</p></div>
        <div><p className={`text-xl font-black ${s.oldestWaitingMin !== null && s.oldestWaitingMin >= prepMin ? "text-rose-400" : "text-amber-100"}`}>{ageLabel(s.oldestWaitingMin)}</p><p className="text-[10px] text-stone-400">oldest</p></div>
        <div><p className={`text-xl font-black ${s.delayed > 0 ? "text-rose-400" : "text-emerald-400"}`}>{s.delayed}</p><p className="text-[10px] text-stone-400">delayed</p></div>
      </div>
    </div>
  );
}

export default function RushModeTab() {
  const [snap, setSnap] = useState<RushSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/rush");
      if (res.ok) {
        setSnap(await res.json());
        setError(null);
      } else if (res.status === 403) setError("Rush Mode is owner/admin only.");
      else if (res.status === 503) setError("Database unavailable.");
      else setError("Could not load Rush Mode.");
    } catch {
      setError("Could not load Rush Mode.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Event-driven refresh on any operational change.
    const es = new EventSource("/api/realtime?channel=orders");
    es.onmessage = () => load();
    // Time-based refresh: ages advance even when nothing changes.
    const tick = window.setInterval(load, TICK_MS);
    return () => {
      es.close();
      window.clearInterval(tick);
    };
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-black text-amber-100">
            <Flame className="h-5 w-5 text-rose-400" /> Rush Mode
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            Live operational picture — where to intervene right now. Ages use existing timestamps;
            "ready" age is approximate (since last update).
          </p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-amber-300" />}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>
      )}

      {snap && !error && (
        <>
          {/* Overall */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Active tables" value={snap.overall.activeTables} />
            <Stat label="Open orders" value={snap.overall.openOrders} />
            <Stat label="Waiting confirm" value={snap.overall.waitingConfirmation} tone={snap.overall.waitingConfirmation > 0 ? "warn" : undefined} />
            <Stat label="Ready for payment" value={snap.overall.readyForPayment} tone={snap.overall.readyForPayment > 0 ? "warn" : undefined} />
            <Stat label="Service calls" value={snap.overall.activeServiceCalls} tone={snap.overall.activeServiceCalls > 0 ? "warn" : undefined} />
          </div>

          {/* Stations */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Station title="Kitchen" icon={<Utensils className="h-4 w-4 text-amber-300" />} s={snap.kitchen} prepMin={snap.thresholds.prepMin} />
            <Station title="Barista" icon={<Coffee className="h-4 w-4 text-amber-300" />} s={snap.barista} prepMin={snap.thresholds.prepMin} />
          </div>

          {/* Waiters */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-100">
              <Users className="h-4 w-4 text-amber-300" /> Waiter workload
            </p>
            {snap.waiters.length === 0 ? (
              <p className="text-xs text-stone-400">No waiter activity yet.</p>
            ) : (
              <div className="space-y-2">
                {snap.waiters.map((w) => (
                  <div key={w.name} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-amber-100">{w.name}</span>
                    <span className="flex gap-4 text-xs text-stone-400">
                      <span><b className="text-amber-100">{w.activeOrders}</b> orders</span>
                      <span><b className="text-amber-100">{w.pendingConfirmations}</b> to confirm</span>
                      <span><b className="text-amber-100">{w.serviceCalls}</b> on the way</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attention — the intervention list */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-100">
              <AlertTriangle className="h-4 w-4 text-rose-400" /> Needs attention
            </p>
            {snap.attention.length === 0 ? (
              <p className="text-xs text-emerald-400">Nothing urgent right now — service is flowing.</p>
            ) : (
              <div className="space-y-2">
                {snap.attention.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${a.delayed ? "border-rose-500/50 bg-rose-950/30" : "border-stone-800 bg-[#171411]"}`}>
                    <span className="flex items-center gap-2 text-amber-100">
                      <BellRing className="h-3.5 w-3.5 text-amber-300" />
                      {a.table} · {a.detail}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-bold ${a.delayed ? "text-rose-400" : "text-amber-300"}`}>
                      <Clock className="h-3 w-3" /> {ageLabel(a.ageMin)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
