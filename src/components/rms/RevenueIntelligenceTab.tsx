"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REVENUE INTELLIGENCE — owner-facing decision view (phone-first)
 * ═══════════════════════════════════════════════════════════════════════════
 *  Extends (does not duplicate) the operational Reports tab: arbitrary ranges,
 *  period comparison, trend, range-based item/category analysis, low sellers,
 *  order patterns and a rule-based "Opportunities" list.
 *
 *  Report-on-demand: loads on mount / period change / manual refresh. No
 *  continuous polling (this is a decision feature, not an ops screen).
 *  Clearly labelled: revenue, NOT profit; no customer / package attribution.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LineChart, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import type { RevenueIntelligenceResult } from "@/lib/revenue-intelligence";

const etb = (n: number) => `${Math.round(n).toLocaleString("en-US")} ETB`;
const pretty = (slug: string) => slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Delta({ value, suffix = "vs previous period" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-[10px] text-stone-500">— {suffix}</span>;
  const up = value > 0, down = value < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold ${up ? "text-emerald-400" : down ? "text-rose-400" : "text-stone-400"}`}>
      <Icon className="h-3 w-3" /> {up ? "+" : ""}{value}% {suffix}
    </span>
  );
}

function Card({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-1 font-serif text-2xl font-black text-amber-100">{value}</p>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

export default function RevenueIntelligenceTab() {
  const [data, setData] = useState<RevenueIntelligenceResult | null>(null);
  const [preset, setPreset] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = custom && from && to ? `preset=custom&from=${from}&to=${to}` : `preset=${preset}`;
    try {
      const res = await fetch(`/api/revenue-intelligence?${qs}`);
      if (res.ok) { setData(await res.json()); setError(null); }
      else if (res.status === 403) setError("Revenue Intelligence is owner/admin only.");
      else setError("Could not load revenue data.");
    } catch { setError("Could not load revenue data."); }
    setLoading(false);
  }, [preset, custom, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-black text-amber-100">
            <LineChart className="h-5 w-5 text-amber-300" /> Revenue Intelligence
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            Understand what sells, when revenue happens, and where the opportunities are. Sales
            performance only — profit/margin need food-cost data and are not included.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-amber-200">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      {/* period selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => { setCustom(false); setPreset(p.key); }}
            className={`rounded-full px-4 py-2 text-xs font-bold ${!custom && preset === p.key ? "bg-[#C9A227] text-[#2C1B17]" : "bg-[#1C120F] text-stone-300"}`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setCustom(true)} className={`rounded-full px-4 py-2 text-xs font-bold ${custom ? "bg-[#C9A227] text-[#2C1B17]" : "bg-[#1C120F] text-stone-300"}`}>Custom</button>
        {custom && (<>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl bg-[#1C120F] border border-stone-700 px-2 py-1.5 text-xs text-white" />
          <span className="text-xs text-stone-500">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl bg-[#1C120F] border border-stone-700 px-2 py-1.5 text-xs text-white" />
        </>)}
      </div>

      {error && <div className="rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>}

      {data && !error && (<>
        {data.range.partial && (
          <p className="text-[11px] text-amber-300">The current period includes today and is still in progress; comparisons are indicative.</p>
        )}

        {/* headline */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card label="Verified revenue" value={etb(data.headline.revenue)} delta={<Delta value={data.headline.revenueChange} />} />
          <Card label="Paid orders" value={String(data.headline.orders)} delta={<Delta value={data.headline.ordersChange} />} />
          <Card label="Avg order value" value={etb(data.headline.aov)} delta={<Delta value={data.headline.aovChange} />} />
        </div>

        {/* opportunities — prominent */}
        <div className="rounded-2xl border border-[#C9A227]/40 bg-[#2C1B17] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-100"><Lightbulb className="h-4 w-4 text-[#C9A227]" /> Opportunities</p>
          {data.opportunities.length === 0 ? (
            <p className="text-xs text-stone-400">No strong signals in this period.</p>
          ) : (
            <ul className="space-y-1.5">{data.opportunities.map((o, i) => <li key={i} className="text-xs text-amber-100">• {o}</li>)}</ul>
          )}
        </div>

        {/* trend */}
        <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
          <p className="mb-3 text-sm font-bold text-amber-100">Revenue trend ({data.range.label})</p>
          <div className="space-y-1">
            {data.trend.filter((t) => t.revenue > 0).slice(0, 14).map((t) => {
              const max = Math.max(...data.trend.map((x) => x.revenue), 1);
              return (
                <div key={t.day} className="flex items-center gap-2 text-[10px]">
                  <span className="w-16 shrink-0 text-stone-400">{t.day.slice(5)}</span>
                  <div className="h-2.5 flex-1 rounded bg-stone-800"><div className="h-2.5 rounded bg-[#C9A227]" style={{ width: `${(t.revenue / max) * 100}%` }} /></div>
                  <span className="w-20 shrink-0 text-right text-stone-300">{etb(t.revenue)}</span>
                </div>
              );
            })}
          </div>
          {data.dayparts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">{data.dayparts.map((d) => <span key={d.name} className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-stone-300">{d.name} {d.pct}%</span>)}</div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* top sellers */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-2 text-sm font-bold text-amber-100">Top sellers</p>
            {data.items.slice(0, 6).map((i) => (
              <div key={i.name} className="flex justify-between py-1 text-xs">
                <span className="text-stone-200">{i.name} <span className="text-stone-500">×{i.quantity}</span></span>
                <span className="text-stone-300">{etb(i.revenue)} · {i.revPct}%</span>
              </div>
            ))}
          </div>
          {/* categories */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-2 text-sm font-bold text-amber-100">Category performance</p>
            {data.categories.slice(0, 6).map((c) => (
              <div key={c.name} className="flex justify-between py-1 text-xs">
                <span className="text-stone-200">{pretty(c.name)}</span>
                <span className="text-stone-300">{etb(c.revenue)} · {c.revPct}%</span>
              </div>
            ))}
          </div>
          {/* payment mix */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-2 text-sm font-bold text-amber-100">Payment mix</p>
            {data.paymentMix.map((p) => (
              <div key={p.method} className="flex justify-between py-1 text-xs">
                <span className="text-stone-200 capitalize">{p.method} <span className="text-stone-500">({p.count})</span></span>
                <span className="text-stone-300">{etb(p.amount)} · {p.pct}%</span>
              </div>
            ))}
          </div>
          {/* order patterns + attachment */}
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-2 text-sm font-bold text-amber-100">Frequently ordered together</p>
            {data.patterns.length === 0 ? <p className="text-xs text-stone-500">Not enough orders in this period.</p> :
              data.patterns.map((p, i) => <p key={i} className="py-0.5 text-xs text-stone-300">{p.a} + {p.b} <span className="text-stone-500">({p.count}×)</span></p>)}
            {data.attachment.attachRate !== null && (
              <p className="mt-2 text-[10px] text-stone-400">{data.attachment.attachRate}% of food orders include a drink (order attachment pattern).</p>
            )}
          </div>
        </div>

        {/* low sellers */}
        {data.lowSellers.length > 0 && (
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-4">
            <p className="mb-2 text-sm font-bold text-amber-100">Low sales — review</p>
            <p className="mb-2 text-[10px] text-stone-500">Low sales suggest repositioning, promoting, or reviewing availability — not necessarily removal.</p>
            {data.lowSellers.map((i) => <p key={i.name} className="py-0.5 text-xs text-stone-300">{i.name} <span className="text-stone-500">×{i.quantity}</span></p>)}
          </div>
        )}
      </>)}
    </div>
  );
}
