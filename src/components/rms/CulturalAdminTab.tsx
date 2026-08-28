"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CULTURAL CONTENT MANAGER — owner admin tab
 * ═══════════════════════════════════════════════════════════════════════════
 *  Turns the cultural layer into an owner-controlled product:
 *    • edit Tonight / feast packages / dish stories / daily special (EN + AM)
 *    • upload a photo from the phone (compressed client-side, persisted to
 *      cdn_images server-side as /api/images/{id})
 *    • draft → preview → publish lifecycle (drafts never reach guests)
 *    • in-admin PREVIEW renders the REAL customer components with the current
 *      (incl. unsaved) values, so wrong photo / price / missing Amharic are
 *      obvious before publishing.
 *
 *  While the table is empty the customer site shows bundled Totot defaults;
 *  the owner "takes control" on first save. Saves that fail (DB down) are
 *  reported as failures — never a fake success.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Music,
  Users,
  BookOpen,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  MonitorSmartphone,
} from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { RESTAURANT, type ExperienceEvent, type FeastPackage, type DishStory } from "@/lib/restaurant";
import TonightSection from "@/components/cultural/TonightSection";
import FeastPackagesSection from "@/components/cultural/FeastPackagesSection";
import StorySection from "@/components/cultural/StorySection";

type Kind = "experience" | "package" | "story" | "special";

interface Item {
  id?: number;
  active?: boolean;
  status?: string;
  image?: string;
  [key: string]: unknown;
}

interface AllContent {
  experiences: Item[];
  packages: Item[];
  stories: Item[];
  specials: Item[];
}

const EMPTY: AllContent = { experiences: [], packages: [], stories: [], specials: [] };

const KIND_META: Record<Kind, { label: string; listKey: keyof AllContent; icon: typeof Music }> = {
  experience: { label: "Tonight / Experiences", listKey: "experiences", icon: Music },
  package: { label: "Feast Packages", listKey: "packages", icon: Users },
  story: { label: "Dish Stories", listKey: "stories", icon: BookOpen },
  special: { label: "Daily Special", listKey: "specials", icon: Sparkles },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-xl bg-[#1C120F] border border-stone-700 px-3 py-2 text-sm text-white focus:border-[#C9A227] focus:outline-none";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
        checked ? "border-emerald-500 bg-emerald-700/40 text-emerald-200" : "border-stone-700 bg-stone-800 text-stone-400"
      }`}
    >
      {checked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function blankFor(kind: Kind): Item {
  switch (kind) {
    case "experience":
      return { title: "", titleAm: "", time: "19:00", durationMin: 45, kind: "music", icon: "Music", description: "", descriptionAm: "", participatory: false, active: true, status: "published" };
    case "package":
      return { name: "", nameAm: "", serves: 2, price: 0, alaCarte: 0, icon: "Users", blurb: "", blurbAm: "", items: [], featured: false, active: true, status: "published" };
    case "story":
      return { dish: "", region: "", regionAm: "", story: "", storyAm: "", howToEat: "", howToEatAm: "", spice: 1, raw: false, fasting: false, vegetarian: false, pairsWith: [], active: true, status: "published" };
    case "special":
      return { title: "", titleAm: "", price: 0, description: "", descriptionAm: "", active: true, status: "published" };
  }
}

function titleOf(kind: Kind, item: Item): string {
  if (kind === "package") return String(item.name || "Untitled package");
  if (kind === "story") return String(item.dish || "Untitled dish");
  return String(item.title || "Untitled");
}
function metaOf(kind: Kind, item: Item): string {
  if (kind === "experience") return `${item.time ?? ""} · ${item.kind ?? ""}`;
  if (kind === "package") return `${item.serves ?? 0} guests · ${item.price ?? 0} ETB`;
  if (kind === "story") return `spice ${item.spice ?? 0}/3`;
  return `${item.price ?? 0} ETB`;
}

export default function CulturalAdminTab() {
  const [kind, setKind] = useState<Kind>("experience");
  const [all, setAll] = useState<AllContent>(EMPTY);
  const [dbOk, setDbOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cultural?scope=admin");
      if (res.ok) {
        const data = await res.json();
        setAll({ ...EMPTY, ...data });
        setDbOk(true);
      } else {
        setDbOk(false);
      }
    } catch {
      setDbOk(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => all[KIND_META[kind].listKey], [all, kind]);

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 900, 0.7);
      setEditing((e) => (e ? { ...e, image: dataUrl } : e));
    } catch {
      flash("Image rejected (max 10MB, JPEG/PNG/WebP/GIF).");
    }
  };

  const save = async (mode: "draft" | "publish") => {
    if (!editing) return;
    setBusy(true);
    const { id, active, image, ...item } = editing;
    const status = mode === "draft" ? "draft" : "published";
    const method = typeof id === "number" ? "PUT" : "POST";
    const body =
      method === "PUT"
        ? { id, item: { ...item, image }, status, active }
        : { kind, item: { ...item, image }, status, active };
    const res = await fetch("/api/cultural", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      flash(mode === "draft" ? "Saved as draft ✓" : "Published ✓");
      setEditing(null);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "Could not save — is the database connected?");
    }
  };

  const toggleActive = async (item: Item) => {
    if (typeof item.id !== "number") return;
    await fetch("/api/cultural", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: item.active === false }),
    });
    load();
  };

  const remove = async (item: Item) => {
    if (typeof item.id !== "number") return;
    if (!window.confirm(`Delete "${titleOf(kind, item)}"?`)) return;
    await fetch("/api/cultural", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    load();
  };

  const set = (patch: Partial<Item>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  /* ── PREVIEW: merge DB content with the in-flight edit, render real customer UI ── */
  const merged = useMemo(() => {
    const mergeList = (list: Item[], fallback: Item[]): Item[] => {
      const base = list.length > 0 ? [...list] : [...fallback];
      if (!editing) return base;
      const idx = typeof editing.id === "number" ? base.findIndex((b) => b.id === editing.id) : -1;
      if (idx >= 0) base[idx] = editing;
      else base.push(editing);
      return base;
    };
    return {
      experiences: mergeList(all.experiences, RESTAURANT.tonight as unknown as Item[]),
      packages: mergeList(all.packages, RESTAURANT.packages as unknown as Item[]),
      stories: mergeList(all.stories, RESTAURANT.dishStories as unknown as Item[]),
    };
  }, [all, editing]);

  const Icon = KIND_META[kind].icon;

  return (
    <div className="bg-[#2C1B17] rounded-3xl border border-[#C9A227]/30 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif font-black text-xl text-amber-100">Cultural Content Manager</h2>
          <p className="mt-1 text-xs text-stone-400">
            Edit Tonight, packages, dish stories and the daily special. Draft → Preview → Publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="rounded-full border border-emerald-500 bg-emerald-700/40 px-3 py-1 text-xs font-bold text-emerald-200">{msg}</span>}
          <button
            onClick={() => setPreview((p) => !p)}
            className="flex items-center gap-2 rounded-xl bg-[#4E342E] px-4 py-2 text-xs font-bold text-amber-200 hover:bg-[#5d4037]"
          >
            <MonitorSmartphone className="h-4 w-4" /> {preview ? "Close preview" : "Preview as customer"}
          </button>
        </div>
      </div>

      {!dbOk && (
        <div className="mb-5 rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-200">
          The database isn't reachable, so edits can't be saved yet. Once Postgres is connected (Coolify) this tab takes
          control; until then guests see the bundled Totot defaults. Saves will report a clear error, never a fake success.
        </div>
      )}

      {/* PREVIEW — the real customer components fed with current values */}
      {preview && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#C9A227]/40">
          <p className="bg-[#C9A227] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#2C1B17]">
            Customer preview (includes unsaved edits)
          </p>
          <div className="max-h-[70vh] overflow-y-auto bg-obsidian">
            <TonightSection experiences={merged.experiences as unknown as ExperienceEvent[]} />
            <FeastPackagesSection packages={merged.packages as unknown as FeastPackage[]} />
            <StorySection stories={merged.stories as unknown as DishStory[]} />
          </div>
        </div>
      )}

      {/* kind switcher */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as Kind[]).map((k) => {
          const M = KIND_META[k];
          const KIcon = M.icon;
          return (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setEditing(null);
              }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold ${
                kind === k ? "bg-[#C9A227] text-[#2C1B17]" : "bg-[#1C120F] text-stone-300 hover:bg-white/10"
              }`}
            >
              <KIcon className="h-4 w-4" /> {M.label}
            </button>
          );
        })}
      </div>

      {/* editor */}
      {editing && (
        <div className="mb-6 space-y-4 rounded-2xl border border-[#C9A227]/40 bg-[#1C120F] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-amber-100">
              {typeof editing.id === "number" ? "Edit" : "New"} — {KIND_META[kind].label}
            </p>
            <button onClick={() => setEditing(null)} className="rounded-lg bg-white/10 p-1.5 text-stone-300" aria-label="Close editor">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Photo upload (all kinds) — phone-friendly */}
          <div className="flex items-center gap-3">
            {editing.image ? (
              <img src={editing.image} alt="" className="h-16 w-24 rounded-xl border border-stone-700 object-cover" />
            ) : (
              <div className="grid h-16 w-24 place-items-center rounded-xl border border-dashed border-stone-700 text-stone-500 text-[10px]">
                no photo
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-white/20">
              <Upload className="h-4 w-4" /> Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
            </label>
            {editing.image && (
              <button onClick={() => set({ image: undefined })} className="text-xs font-bold text-rose-300">
                Remove
              </button>
            )}
          </div>

          {kind === "experience" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title (EN)"><input className={inputCls} value={String(editing.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Title (አማርኛ)"><input className={inputCls} value={String(editing.titleAm ?? "")} onChange={(e) => set({ titleAm: e.target.value })} /></Field>
              <Field label="Start time"><input className={inputCls} value={String(editing.time ?? "")} onChange={(e) => set({ time: e.target.value })} placeholder="19:45" /></Field>
              <Field label="Duration (min)"><input type="number" className={inputCls} value={Number(editing.durationMin ?? 45)} onChange={(e) => set({ durationMin: Number(e.target.value) })} /></Field>
              <Field label="Type">
                <select className={inputCls} value={String(editing.kind ?? "music")} onChange={(e) => set({ kind: e.target.value })}>
                  {["music", "dance", "coffee", "special", "show"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Description (EN)"><input className={inputCls} value={String(editing.description ?? "")} onChange={(e) => set({ description: e.target.value })} /></Field>
              <div className="sm:col-span-2 flex gap-2">
                <Toggle checked={Boolean(editing.participatory)} onChange={(v) => set({ participatory: v })} label="Guests can join" />
                <Toggle checked={editing.active !== false} onChange={(v) => set({ active: v })} label="Active tonight" />
              </div>
            </div>
          )}

          {kind === "package" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name (EN)"><input className={inputCls} value={String(editing.name ?? "")} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Name (አማርኛ)"><input className={inputCls} value={String(editing.nameAm ?? "")} onChange={(e) => set({ nameAm: e.target.value })} /></Field>
              <Field label="Serves"><input type="number" className={inputCls} value={Number(editing.serves ?? 2)} onChange={(e) => set({ serves: Number(e.target.value) })} /></Field>
              <Field label="Package price (ETB)"><input type="number" className={inputCls} value={Number(editing.price ?? 0)} onChange={(e) => set({ price: Number(e.target.value) })} /></Field>
              <Field label="À-la-carte total (saving is auto-computed)"><input type="number" className={inputCls} value={Number(editing.alaCarte ?? 0)} onChange={(e) => set({ alaCarte: Number(e.target.value) })} /></Field>
              <Field label="Blurb (EN)"><input className={inputCls} value={String(editing.blurb ?? "")} onChange={(e) => set({ blurb: e.target.value })} /></Field>
              <Field label="Items (one per line)">
                <textarea className={inputCls} rows={4} value={Array.isArray(editing.items) ? (editing.items as string[]).join("\n") : ""} onChange={(e) => set({ items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </Field>
              <div className="flex items-end gap-2">
                <Toggle checked={Boolean(editing.featured)} onChange={(v) => set({ featured: v })} label="Featured" />
                <Toggle checked={editing.active !== false} onChange={(v) => set({ active: v })} label="Available" />
              </div>
            </div>
          )}

          {kind === "story" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dish name"><input className={inputCls} value={String(editing.dish ?? "")} onChange={(e) => set({ dish: e.target.value })} /></Field>
              <Field label="Region (EN)"><input className={inputCls} value={String(editing.region ?? "")} onChange={(e) => set({ region: e.target.value })} /></Field>
              <Field label="Spice (0–3)"><input type="number" min={0} max={3} className={inputCls} value={Number(editing.spice ?? 1)} onChange={(e) => set({ spice: Math.max(0, Math.min(3, Number(e.target.value))) })} /></Field>
              <Field label="Story (EN)"><textarea className={inputCls} rows={3} value={String(editing.story ?? "")} onChange={(e) => set({ story: e.target.value })} /></Field>
              <Field label="How to eat (EN)"><textarea className={inputCls} rows={2} value={String(editing.howToEat ?? "")} onChange={(e) => set({ howToEat: e.target.value })} /></Field>
              <Field label="Pairs with (comma-separated)"><input className={inputCls} value={Array.isArray(editing.pairsWith) ? (editing.pairsWith as string[]).join(", ") : ""} onChange={(e) => set({ pairsWith: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Toggle checked={Boolean(editing.raw)} onChange={(v) => set({ raw: v })} label="Served raw" />
                <Toggle checked={Boolean(editing.fasting)} onChange={(v) => set({ fasting: v })} label="Fasting food" />
                <Toggle checked={Boolean(editing.vegetarian)} onChange={(v) => set({ vegetarian: v })} label="Vegetarian" />
                <Toggle checked={editing.active !== false} onChange={(v) => set({ active: v })} label="Active" />
              </div>
            </div>
          )}

          {kind === "special" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Special (EN)"><input className={inputCls} value={String(editing.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Special (አማርኛ)"><input className={inputCls} value={String(editing.titleAm ?? "")} onChange={(e) => set({ titleAm: e.target.value })} /></Field>
              <Field label="Price (ETB)"><input type="number" className={inputCls} value={Number(editing.price ?? 0)} onChange={(e) => set({ price: Number(e.target.value) })} /></Field>
              <Field label="Description (EN)"><input className={inputCls} value={String(editing.description ?? "")} onChange={(e) => set({ description: e.target.value })} /></Field>
              <Toggle checked={editing.active !== false} onChange={(v) => set({ active: v })} label="Available today" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => save("publish")} disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#C9A227] px-5 py-2.5 text-sm font-extrabold text-[#2C1B17] disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & publish
            </button>
            <button onClick={() => save("draft")} disabled={busy} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-stone-300 disabled:opacity-50">
              Save as draft
            </button>
            <button onClick={() => setEditing(null)} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-stone-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-stone-800 bg-[#1C120F] p-6 text-center text-sm text-stone-400">
            No {KIND_META[kind].label.toLowerCase()} in the database yet — guests currently see the bundled Totot defaults.
            Add your first item to take control.
          </div>
        ) : (
          items.map((item) => (
            <div key={String(item.id)} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-800 bg-[#1C120F] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt="" className="h-10 w-14 shrink-0 rounded-lg border border-stone-700 object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C9A227]/15 text-[#C9A227]"><Icon className="h-4 w-4" /></span>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-bold text-amber-100">
                    {titleOf(kind, item)}
                    {item.status === "draft" && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">draft</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-400">{metaOf(kind, item)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => toggleActive(item)} title={item.active === false ? "Activate" : "Deactivate"} className={`rounded-lg p-2 ${item.active === false ? "bg-stone-800 text-stone-500" : "bg-emerald-700/40 text-emerald-300"}`}>
                  {item.active === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditing({ ...item })} className="rounded-lg bg-white/10 p-2 text-amber-200" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(item)} className="rounded-lg bg-rose-600/30 p-2 text-rose-300" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => setEditing(blankFor(kind))} className="mt-4 flex items-center gap-2 rounded-xl bg-[#C9A227] px-5 py-2.5 text-sm font-extrabold text-[#2C1B17]">
        <Plus className="h-4 w-4" /> Add {kind}
      </button>
    </div>
  );
}
