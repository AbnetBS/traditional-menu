"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ORDER HEALTH — "which orders need intervention, and where?"
 * ═══════════════════════════════════════════════════════════════════════════
 *  An operational list (not an analytics dashboard), grouped by severity:
 *  NEEDS ATTENTION → AT RISK → HEALTHY. Each ticket shows its health badge,
 *  the offending stage ("where"), age, per-item/station chips, and a separate
 *  ⚠ service-call warning that never alters the food health state.
 *
 *  Realtime: existing SSE `orders` channel for change-driven refresh + ONE
 *  20s tick for time-based aging (cleaned up on unmount, skipped when the tab
 *  is hidden). No per-order timers, no polling per ticket.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HeartPulse, BellRing, Loader2, Clock, AlertTriangle } from "lucide-react";
import type { OrderHealthSnapshot, TicketHealth, HealthState } from "@/lib/order-health";

const TICK_MS = 20_000;

const STATE_META: Record<HealthState, { label: string; dot: string; text: string }> = {
  DELAYED: { label: "Delayed", dot: "bg-rose-500", text: "text-rose-400" },
  AT_RISK: { label: "At risk", dot: "bg-amber-400", text: "text-amber-300" },
  WAITING: { label: "Waiting", dot: "bg-stone-400", text: "text-stone-300" },
  HEALTHY: { label: "Healthy", dot: "bg-emerald-500", text: "text-emerald-400" },
};

function ageLabel(min: number | null): string {
  if (min === null) return "—";
  const m = Math.floor(min);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function TicketCard({ t }: { t: TicketHealth }) {
  const meta = STATE_META[t.state];
  return (
    <div className={`rounded-2xl border p-4 ${t.state === "DELAYED" ? "border-rose-500/50 bg-rose-950/20" : t.state === "AT_RISK" ? "border-amber-500/40 bg-amber-950/10" : "border-stone-800 bg-[#1C120F]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
          <span className="font-serif font-bold text-amber-100">{t.tableName}</span>
          {t.orderNumber && <span className="text-xs text-stone-400">#{String(t.orderNumber).replace(/^[A-Z]+-/, "")}</span>}
        </div>
        <span className={`flex items-center gap-1 text-xs font-bold ${meta.text}`}>
          <Clock className="h-3 w-3" /> {ageLabel(t.ageMin)}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-stone-400">
        {t.state !== "HEALTHY" && t.where ? (
          <>
            <span className={`font-bold ${meta.text}`}>{t.where}</span> ·{" "}
          </>
        ) : null}
        {t.status.replace(/_/g, " ")}
      </p>

      {/* item / station chips */}
      {t.items.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {t.items.map((it, i) => {
            const im = STATE_META[it.state];
            return (
              <span key={i} className="flex items-center gap-1.5 rounded-full border border-stone-700 bg-[#171411] px-2.5 py-1 text-[11px] text-stone-300">
                <span className={`h-1.5 w-1.5 rounded-full ${im.dot}`} />
                {it.name}
                {it.quantity > 1 ? ` ×${it.quantity}` : ""} · {it.station === "barista" ? "Bar" : "Kitchen"}
              </span>
            );
          })}
        </div>
      )}

      {/* separate service warning — does not alter food health */}
      {t.serviceWarning && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-amber-300">
          <BellRing className="h-3.5 w-3.5" /> {t.serviceWarning.kind} requested · {t.serviceWarning.ageMin} min
        </p>
      )}
    </div>
  );
}

function Group({ title, icon, list }: { title: string; icon: ReactNode; list: TicketHealth[] }) {
  if (list.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
        {icon} {title} ({list.length})
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((t) => (
          <TicketCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function OrderHealthTab() {
  const [snap, setSnap] = useState<OrderHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return; // skip work when backgrounded
    try {
      const res = await fetch("/api/order-health");
      if (res.ok) {
        setSnap(await res.json());
        setError(null);
      } else if (res.status === 403) setError("Order Health is owner/admin only.");
      else if (res.status === 503) setError("Database unavailable.");
      else setError("Could not load Order Health.");
    } catch {
      setError("Could not load Order Health.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const es = new EventSource("/api/realtime?channel=orders");
    es.onmessage = () => load();
    const tick = window.setInterval(load, TICK_MS);
    return () => {
      es.close();
      window.clearInterval(tick);
    };
  }, [load]);

  const delayed = snap?.tickets.filter((t) => t.state === "DELAYED") ?? [];
  const atRisk = snap?.tickets.filter((t) => t.state === "AT_RISK") ?? [];
  const healthy = snap?.tickets.filter((t) => t.state === "HEALTHY" || t.state === "WAITING") ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-black text-amber-100">
            <HeartPulse className="h-5 w-5 text-rose-400" /> Order Health
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            Which orders need intervention and where. Prep & ready ages are approximations
            (no accepted_at / ready_at yet); waiting-for-waiter and station-waiting are exact.
          </p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-amber-300" />}
      </div>

      {error && <div className="rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>}

      {snap && !error && (
        <>
          <div className="flex gap-3 text-xs">
            <span className="rounded-full bg-rose-500/15 px-3 py-1 font-bold text-rose-400">{snap.counts.delayed} delayed</span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-bold text-amber-300">{snap.counts.atRisk} at risk</span>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-bold text-emerald-400">{snap.counts.healthy} healthy</span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-bold text-amber-300">{snap.counts.serviceWarnings} service warnings</span>
          </div>

          {snap.tickets.length === 0 ? (
            <p className="text-sm text-emerald-400">No open orders right now.</p>
          ) : (
            <>
              <Group title="Needs attention" icon={<AlertTriangle className="h-4 w-4 text-rose-400" />} list={delayed} />
              <Group title="At risk" icon={<Clock className="h-4 w-4 text-amber-300" />} list={atRisk} />
              <Group title="Healthy / on track" icon={<HeartPulse className="h-4 w-4 text-emerald-400" />} list={healthy} />
            </>
          )}
        </>
      )}
    </div>
  );
}
