"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Minus, Search, Send, CheckCircle2, Clock, X, Phone, Utensils, Loader2, QrCode,
  ChevronLeft, ChevronRight, MapPin, Star, MessageSquare, Camera, Globe, Music2,
} from "lucide-react";
import { MenuItem, Category, CafeTable, SiteSettings, Announcement, GalleryItem, Review } from "@/types";
import { effectivePrice } from "@/lib/price";
import { fixBrandText } from "@/lib/brand";
import { useMenuText, useT, useLang } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";
import { optimizeImageUrl, FALLBACK_FOOD_IMAGE } from "@/lib/image-utils";
import { RESTAURANT, dishStoryFor } from "@/lib/restaurant";
import { TibebBand, SpiceMeter, DishFlag } from "@/components/cultural/Patterns";
import {
  FrameCorners, OrnamentDivider, MesobSeal, JebenaMark,
} from "@/components/rms/totot-menu-decor";
import {
  BellRing,
  Receipt,
  Croissant,
  Coffee as CoffeeIcon,
  Wine,
  PartyPopper,
  HandHelping,
  X as CloseX,
} from "lucide-react";

interface CartEntry {
  menuItemId: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  notes: string;
}

export default function CustomerMenuApp() {
  const searchParams = useSearchParams();
  const tableId = Number(searchParams.get("table") || 0);
  const t = useT();
  const menuText = useMenuText();

  // Start with EMPTY states — NEVER flash the default demo items for those first seconds.
  // Customers now see a branded loading skeleton until real menu data arrives from the database.
  // The fallback contact data comes from the configured restaurant
  // (src/lib/restaurant.ts) — never from another business's settings.
  const [settings, setSettings] = useState<SiteSettings>({
    cafe_name: RESTAURANT.identity.name,
    tagline: RESTAURANT.identity.tagline,
    phone: RESTAURANT.contact.phoneDisplay,
    address: RESTAURANT.contact.address,
    plus_code: RESTAURANT.contact.plusCode,
    lat: RESTAURANT.contact.lat,
    lng: RESTAURANT.contact.lng,
    opening_hours: RESTAURANT.contact.hoursNote,
    about_description: RESTAURANT.identity.story,
    logo_url: "",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [tableName, setTableName] = useState(tableId ? `Table ${tableId}` : "");

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState("");

  /* ── CALL THE WAITER (without shouting across a loud hall) ── */
  const [lang] = useLang();
  const [callOpen, setCallOpen] = useState(false);
  const [callSending, setCallSending] = useState<string | null>(null);
  const [callToast, setCallToast] = useState<string | null>(null);

  const sendServiceCall = async (kind: string) => {
    setCallSending(kind);
    try {
      const res = await fetch("/api/service-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, kind }),
      });
      if (res.ok) {
        const am = lang === "am";
        setCallToast(
          am
            ? "ጥያቄዎ ርሷል — ሰርቨርዎ በመንገድ ላይ ነው።"
            : "Request sent — your waiter is on the way."
        );
        setCallOpen(false);
        window.setTimeout(() => setCallToast(null), 3500);
      }
    } catch {
      // Network hiccup — the guest can simply tap again.
    } finally {
      setCallSending(null);
    }
  };

  // ── IDEMPOTENCY (Group 1): one key per submission attempt, reused on retries so
  //    a double-tap or WiFi retry can NEVER create a duplicate order. If the cart
  //    changes after a failed attempt, the next click is a NEW submission (new key).
  const pendingKeyRef = useRef("");
  const lastCartSigRef = useRef("");

  useEffect(() => {
    const sig = JSON.stringify(cart);
    if (pendingKeyRef.current && lastCartSigRef.current && sig !== lastCartSigRef.current) {
      pendingKeyRef.current = ""; // cart edited → next submit is a brand-new submission
    }
  }, [cart]);

  const newSubmissionKey = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Daily Board + bottom content
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryItem[]>([]);
  // Customer gallery lightbox — index into galleryPhotos, or null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [approvedReviews, setApprovedReviews] = useState<Review[]>([]);
  const [revName, setRevName] = useState("");
  const [revRating, setRevRating] = useState(5);
  const [revText, setRevText] = useState("");
  const [revSending, setRevSending] = useState(false);
  const [revMsg, setRevMsg] = useState("");

  // Client-approved Totot logo (public/totot-logo.png) — never another business's badge.
  const logoUrl = String(settings.logo_url || RESTAURANT.identity.defaultLogo);
  // Brand guard: always serve the configured business name (src/lib/restaurant.ts);
  // legacy venue text is repaired to it, never rendered.
  const brandName = fixBrandText(settings.cafe_name || RESTAURANT.identity.name);

  // SPEED: show cached menu + announcements INSTANTLY on repeat visits,
  // then refresh silently in the background (stale-while-revalidate)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("tm_menu_cache_v1");
      if (cached) {
        const { t: cachedAt, data } = JSON.parse(cached);
        if (Date.now() - cachedAt < 300_000 && data) {
          if (data.menuItems) setMenuItems(data.menuItems);
          if (data.categories) setCategories(data.categories);
          if (data.announcements) setAnnouncements(data.announcements);
          if (data.galleryPhotos) setGalleryPhotos(data.galleryPhotos);
          if (data.approvedReviews) setApprovedReviews(data.approvedReviews);
        }
      }
    } catch {}
  }, [tableId]);

  // Extracted so a stale-cart submit ("Unknown menu item") can re-pull the menu.
  // Returns the fresh menu items (used to prune a stale cart) or null on failure.
  const loadAllData = useCallback(async (): Promise<MenuItem[] | null> => {
    try {
      // 1. Critical path for instant ordering: menu items, categories, settings, and tables
      const corePromise = Promise.all([
        fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/categories").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/menu?promo=1").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/tables").then((r) => (r.ok ? r.json() : null)),
      ]);

      // 2. Secondary path: below-the-fold announcements, gallery, reviews
      const secondaryPromise = Promise.all([
        fetch("/api/announcements?active=1").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/gallery").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/reviews").then((r) => (r.ok ? r.json() : [])),
      ]);

      const [s, c, m, tbl] = await corePromise;
      const fresh: Record<string, unknown> = {};
      let freshMenu: MenuItem[] | null = null;

      if (s) setSettings(s);
      if (c) {
        setCategories(c);
        fresh.categories = c;
      }
      if (m) {
        setMenuItems(m);
        fresh.menuItems = m;
        freshMenu = m;
      }
      if (tbl) {
        const found = tbl.find((x: CafeTable) => x.id === tableId);
        if (found) setTableName(found.name);
      }
      // Critical menu rendering unlocks immediately!
      setMenuLoading(false);

      // Await secondary below-the-fold content without delaying menu interaction
      const [anns, gal, revs] = await secondaryPromise;
      if (anns) {
        setAnnouncements(anns);
        fresh.announcements = anns;
      }
      if (gal) {
        const p = gal.slice(0, 8);
        setGalleryPhotos(p);
        fresh.galleryPhotos = p;
      }
      if (revs) {
        const ap = revs.filter((r: Review) => r.isApproved).slice(0, 5);
        setApprovedReviews(ap);
        fresh.approvedReviews = ap;
      }

      // update instant-cache for the next visit
      try {
        sessionStorage.setItem("tm_menu_cache_v1", JSON.stringify({ t: Date.now(), data: fresh }));
      } catch {}
      return freshMenu;
    } catch {
      setMenuLoading(false);
      return null;
    }
  }, [tableId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Daily Board auto-slide when 2+ announcements (seconds interval), swipeable with arrows
  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % announcements.length), 4500);
    return () => clearInterval(t);
  }, [announcements.length]);

  useEffect(() => {
    setSlideIdx(0);
  }, [announcements.length]);

  // ── GALLERY LIGHTBOX: close + previous/next + keyboard shortcuts ──
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const stepLightbox = useCallback(
    (dir: 1 | -1) =>
      setLightboxIndex((cur) => {
        if (cur === null || galleryPhotos.length === 0) return cur;
        return (cur + dir + galleryPhotos.length) % galleryPhotos.length;
      }),
    [galleryPhotos.length]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    };
    window.addEventListener("keydown", onKey);
    // Prevent background scroll while the viewer is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, closeLightbox, stepLightbox]);

  const submitReview = async () => {
    if (!revName.trim() || !revText.trim()) {
      setRevMsg(t("review_need_name"));
      return;
    }
    setRevSending(true);
    const r = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: revName.trim(), rating: revRating, reviewText: revText.trim() }),
    });
    setRevSending(false);
    if (r.ok) {
      setRevName("");
      setRevText("");
      setRevMsg(t("review_thanks"));
    } else setRevMsg(t("review_fail"));
  };

  const filteredMenu = useMemo(
    () =>
      menuItems.filter(
        (m) =>
          (category === "all" || m.category === category) &&
          (m.name.toLowerCase().includes(search.toLowerCase()) ||
            menuText(m.name).toLowerCase().includes(search.toLowerCase()) ||
            menuText(m.description).toLowerCase().includes(search.toLowerCase()))
      ),
    [menuItems, category, search, menuText]
  );

  // Unified quantity control: qty 0 = remove from cart (fixes "accidental Add" confusion)
  // Applies the auto-scheduled SALE price when active for today.
  const setQty = (m: MenuItem, qty: number) => {
    if (!m.isAvailable) return;
    const { price: unitPrice } = effectivePrice(m);
    setCart((prev) => {
      const exists = prev.find((c) => c.menuItemId === m.id);
      if (qty <= 0) return prev.filter((c) => c.menuItemId !== m.id);
      if (exists) return prev.map((c) => (c.menuItemId === m.id ? { ...c, quantity: qty, price: unitPrice } : c));
      return [...prev, { menuItemId: m.id, name: m.name, category: m.category, price: unitPrice, quantity: qty, notes: "" }];
    });
  };

  const addToCart = (m: MenuItem) => setQty(m, 1);

  const cartQty = (id: number) => cart.find((c) => c.menuItemId === id)?.quantity || 0;

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const submitOrder = async () => {
    if (cart.length === 0 || !tableId || submitting) return;
    if (!pendingKeyRef.current) pendingKeyRef.current = newSubmissionKey();
    lastCartSigRef.current = JSON.stringify(cart);
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          source: "customer",
          idempotencyKey: pendingKeyRef.current,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            name: c.name,
            category: c.category,
            price: c.price,
            quantity: c.quantity,
            notes: c.notes,
          })),
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setLastOrderNumber(d.orderNumber || "");
        pendingKeyRef.current = ""; // submission recorded — next cart is a new order
        setSubmitted(true);
        setCart([]);
        setReviewMode(false);
      } else {
        // Server returns customer-friendly messages (raw DB errors are logged
        // server-side, never shown to guests). One special case: the tab holds
        // a cached menu where an item was since removed/changed by the owner —
        // silently refresh the menu instead of confusing the guest.
        const d = await r.json().catch(() => ({}));
        if (r.status === 400 && String(d.error || "").includes("Unknown menu item")) {
          try { sessionStorage.removeItem("tm_menu_cache_v1"); } catch {}
          setError("");
          setReviewMode(false);
          const freshMenu = await loadAllData();
          if (freshMenu) {
            // Drop cart rows whose item no longer exists on the (updated) menu,
            // so the guest re-adds from what's actually available now.
            const validIds = new Set(freshMenu.map((fm) => fm.id));
            setCart((prev) => prev.filter((row) => validIds.has(row.menuItemId)));
          }
          pendingKeyRef.current = ""; // cart may change → fresh submission key
          setError(t("err_menu_updated"));
        } else {
          setError(d.error || t("err_submit"));
        }
      }
    } catch {
      // Safe retry: the same key is reused, so the kitchen will never cook twice.
      setError(t("err_connection"));
    } finally {
      setSubmitting(false);
    }
  };

  // Contact fallbacks always come from the configured restaurant
  // (src/lib/restaurant.ts) — never from another business's data.
  const phone = settings.phone || RESTAURANT.contact.phoneDisplay;
  const phoneHref = String(phone).replace(/[^\d+]/g, "");
  const address = settings.address || RESTAURANT.contact.address;
  const hours = settings.opening_hours || RESTAURANT.contact.hoursNote;
  const plusCode = settings.plus_code || RESTAURANT.contact.plusCode;
  const mapsQuery = encodeURIComponent(plusCode || `${RESTAURANT.contact.lat},${RESTAURANT.contact.lng}`);

  /* ── Submitted confirmation ── */
  if (submitted) {
    return (
      <div className="tm-root flex items-center justify-center p-6 pb-24">
        <div className="tm-panel w-full max-w-sm p-8 text-center space-y-4">
          <FrameCorners />
          <div className="tm-seal mx-auto" style={{ width: 72, height: 72 }}>
            <CheckCircle2 className="w-9 h-9 text-[#4e9a6b]" />
          </div>
          <h1 className="tm-head text-2xl font-bold">{t("order_sent_title")}</h1>
          {lastOrderNumber && (
            <p className="inline-block rounded-full border border-[#b8955a]/60 bg-[#2b1b13] px-4 py-1.5 text-sm font-black tracking-wide text-[#d8b97e]">
              {lang === "am" ? `ትዕዛዝ #${lastOrderNumber}` : `Order #${lastOrderNumber}`}
            </p>
          )}
          <div className="tm-panel-wood rounded-lg p-4 space-y-1">
            <div className="text-gold/50" aria-hidden="true">
              <TibebBand height={8} />
            </div>
            <p className="text-sm font-bold text-[#f2e4c6] flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4 text-[#d8b97e]" /> {t("waiting_confirmation")}
            </p>
            <p className="text-xs text-[#ded2bd]">
              {t("waiter_walking", { table: menuText(tableName) })}
            </p>
          </div>
          <p className="text-xs text-[#6d563f]">{t("add_more_note")}</p>
          <button onClick={() => setSubmitted(false)} className="tm-btn w-full py-3.5 text-sm font-bold">
            {t("back_to_menu")}
          </button>
        </div>
      </div>
    );
  }

  /* ── Invalid table ── */
  if (!tableId) {
    return (
      <div className="tm-root flex items-center justify-center p-6 text-center">
        <div className="tm-panel w-full max-w-sm p-8 space-y-3">
          <FrameCorners />
          <QrCode className="w-10 h-10 text-[#b8603d] mx-auto" />
          <h1 className="tm-head text-xl font-bold">{t("scan_qr_title")}</h1>
          <p className="text-sm text-[#6d563f]">{t("scan_qr_sub")}</p>
        </div>
      </div>
    );
  }

  /* ── REVIEW MODE (before submit) ── */
  if (reviewMode) {
    return (
      <div className="tm-root pb-32">
        <header className="sticky top-0 z-40 border-b border-[#b8955a]/40 bg-[#241710]/95 backdrop-blur-md">
          <div className="text-[#b8955a]/40" aria-hidden="true">
            <TibebBand height={8} />
          </div>
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
            <button onClick={() => setReviewMode(false)} className="tm-btn-ghost flex h-9 w-9 items-center justify-center" aria-label={t("close")}>
              <X className="w-4 h-4" />
            </button>
            <h1 className="tm-head tm-head-dark flex-1 truncate text-base font-bold">
              {t("review_your_order")} — {menuText(tableName)}
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
          {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          {cart.map((c) => (
            <div key={c.menuItemId} className="tm-panel p-4 space-y-2">
              <FrameCorners />
              <div className="flex items-center justify-between gap-3">
                <p className="tm-dish-name text-sm leading-tight">{menuText(c.name)}</p>
                <p className="font-extrabold whitespace-nowrap text-[#9a4e32]">{c.price * c.quantity} ETB</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCart(cart.map((x) => (x.menuItemId === c.menuItemId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}
                  className="tm-btn-dimm flex h-8 w-8 items-center justify-center"
                  aria-label="Decrease"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-extrabold text-[#2e1d12]">{c.quantity}</span>
                <button
                  onClick={() => setCart(cart.map((x) => (x.menuItemId === c.menuItemId ? { ...x, quantity: x.quantity + 1 } : x)))}
                  className="tm-btn flex h-8 w-8 items-center justify-center"
                  aria-label="Increase"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setCart(cart.filter((x) => x.menuItemId !== c.menuItemId))} className="ml-auto text-xs font-bold text-[#8f3b2c]">
                  {t("remove")}
                </button>
              </div>
              <input
                value={c.notes}
                onChange={(e) => setCart(cart.map((x) => (x.menuItemId === c.menuItemId ? { ...x, notes: e.target.value } : x)))}
                placeholder={t("note_ph")}
                className="tm-input w-full px-3 py-2 text-xs"
              />
            </div>
          ))}
        </div>

        {/* submit bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[#b8955a]/70 bg-[#241710]/95 backdrop-blur-md p-4">
          <div className="tm-texture-through mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a98c5f]">{cartCount} {t("items_label")}</p>
              <p className="tm-head tm-engraved text-xl font-black">{cartTotal} ETB</p>
            </div>
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="tm-btn-gold flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-black uppercase disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? t("sending") : t("submit_order")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── MAIN MENU ── */
  return (
    <div className="tm-root pb-28">
      <LanguageToggle className={cart.length > 0 ? "bottom-28" : ""} />
      {/* ── CULTURAL HEADER — the carved-wood door to the feast ── */}
      <header className="sticky top-0 z-40 border-b border-[#b8955a]/30 bg-[#241710]/95 backdrop-blur-md shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
        <div className="text-[#b8955a]/50" aria-hidden="true">
          <TibebBand height={8} />
        </div>
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <MesobSeal src={logoUrl} alt={brandName} size={42} />
            <div className="min-w-0">
              <p className="tm-head tm-head-dark truncate text-sm font-semibold leading-tight">
                {lang === "am" ? RESTAURANT.identity.nameAm : RESTAURANT.identity.shortName}
              </p>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8955a]">
                <span className="inline-block h-1 w-1 rotate-45 bg-[#b8955a]" />
                {lang === "am" ? `ጠረጴዛዎ • ${menuText(tableName)}` : `Your table • ${menuText(tableName)}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCallOpen(true)}
            className="tm-btn flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[11px] font-extrabold"
          >
            <BellRing className="h-3.5 w-3.5" /> {t("waiter")}
          </button>
        </div>
      </header>

      {/* intro — bilingual, calm */}
      <div className="border-b border-[#b8955a]/20 bg-[#1f1410] px-4 py-2 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] tracking-wide text-[#ded2bd]">
          <JebenaMark className="h-3.5 w-3.5 text-[#b8955a]" />
          {t("intro")}
        </p>
      </div>

      {/* ── 📢 DAILY BOARD — framed artwork: rotating promotions ── */}
      {announcements.length > 0 && (
        <div className="mx-4 mt-4 max-w-lg lg:mx-auto">
          {(() => {
            const a = announcements[slideIdx];
            const hasPhoto = Boolean(a?.imageUrl);
            // Promo CTA: this announcement is linked to a live menu item —
            // the item already carries the promo price (menu fetched with
            // ?promo=1), so tapping it opens the normal ordering sheet.
            const promoItem = a?.menuItemId ? menuItems.find((m) => m.id === a.menuItemId) : undefined;
            const promoPrice = a?.salePrice && promoItem ? effectivePrice(promoItem) : null;
            return (
              <div className="tm-panel-wood relative overflow-hidden rounded-xl min-h-[180px]">
                {/* carved inner frame */}
                <span className="pointer-events-none absolute inset-[5px] z-20 rounded-lg border border-[#b8955a]/45" />
                <FrameCorners className="z-30" />

                {/* full-bleed photo (framed like a wall painting) */}
                {hasPhoto && (
                  <>
                    <img src={optimizeImageUrl(a!.imageUrl!, 800, 500)} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { const el = e.currentTarget; if (!el.src.includes("placeholder")) el.src = FALLBACK_FOOD_IMAGE; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
                  </>
                )}

                {/* no photo → woven earth artwork: terracotta/gold with pattern */}
                {!hasPhoto && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8f3b2c] via-[#b8603d] to-[#b8955a]" />
                    <div className="pattern-mesob absolute inset-0 opacity-90" />
                  </>
                )}

                {/* content overlay */}
                <div className={`relative z-10 flex min-h-[180px] flex-col justify-end p-5`}>
                  <p
                    className={`tm-head text-xl font-black leading-tight ${
                      hasPhoto
                        ? "text-[#fdf3e0] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                        : "text-[#fdf3e0] drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]"
                    }`}
                  >
                    {menuText(a?.title || "")}
                  </p>
                  {a?.description && (
                    <p
                      className={`mt-0.5 text-[13px] font-semibold leading-snug ${
                        hasPhoto ? "text-[#f2e8d5] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" : "text-[#f7ecd6]"
                      }`}
                    >
                      {menuText(a.description)}
                    </p>
                  )}
                  {promoItem && promoPrice?.onSale && (
                    <button
                      type="button"
                      onClick={() => setDetailItem(promoItem)}
                      className="tm-btn-gold mt-3 flex w-fit items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wide"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {menuText(promoItem.name)} — {promoPrice.price} ETB
                      {promoPrice.savings > 0 && ` (save ${promoPrice.savings})`}
                    </button>
                  )}
                </div>

                {/* controls — carved wood buttons */}
                {announcements.length > 1 && (
                  <>
                    <button
                      onClick={() => setSlideIdx((slideIdx - 1 + announcements.length) % announcements.length)}
                      className="absolute left-2 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#b8955a]/60 bg-black/50 text-[#f2e4c6] backdrop-blur-sm transition hover:bg-black/70"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSlideIdx((slideIdx + 1) % announcements.length)}
                      className="absolute right-2 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#b8955a]/60 bg-black/50 text-[#f2e4c6] backdrop-blur-sm transition hover:bg-black/70"
                      aria-label="Next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
                      {announcements.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSlideIdx(i)}
                          className={`h-1.5 rounded-full transition ${i === slideIdx ? "w-4 bg-[#d8b97e]" : "w-1.5 bg-[#f2e4c6]/50"}`}
                          aria-label={`Slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* search + categories — sticky carved toolbar */}
      <div className="tm-toolbar sticky top-[66px] z-30 px-4 pt-3 pb-2 space-y-2 max-w-lg mx-auto">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a08567]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_ph")}
            className="tm-input w-full pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <div className="tm-scroll-x flex gap-2 overflow-x-auto pb-1.5">
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`tm-chip whitespace-nowrap px-3.5 py-1.5 text-xs font-bold transition ${category === c.slug ? "tm-chip-active" : ""}`}
            >
              {menuText(c.name)}
            </button>
          ))}
        </div>
      </div>

      {/* Branded skeleton — carved panels while the menu loads */}
      {menuLoading && menuItems.length === 0 && (
        <div className="mx-auto max-w-lg space-y-4 px-4 pt-2">
          <div className="tm-panel py-6 text-center space-y-2">
            <FrameCorners />
            <div className="relative mx-auto h-14 w-14">
              <img src={logoUrl} alt="Loading" className="mx-auto h-14 w-14 animate-pulse rounded-full object-contain" />
              <span className="absolute inset-0 rounded-full border-2 border-[#b8955a] animate-ping opacity-30" />
            </div>
            <p className="tm-head text-sm font-bold">{t("loading_menu")}</p>
            <p className="text-[11px] text-[#6d563f]">{t("loading_sub")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="tm-panel animate-pulse overflow-hidden">
                <div className="m-1 h-28 rounded-md bg-[#d8c9a8]" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-4/5 rounded bg-[#d8c9a8]" />
                  <div className="h-2.5 w-2/3 rounded bg-[#d8c9a8]" />
                  <div className="flex justify-between pt-1">
                    <div className="h-4 w-14 rounded bg-[#d8c9a8]" />
                    <div className="h-6 w-16 rounded bg-[#d8c9a8]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* menu grid — parchment cards in a carved-wood wall */}
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 px-4">
        {filteredMenu.map((m) => {
          const qty = cartQty(m.id);
          const out = !m.isAvailable;
          return (
            <div key={m.id} className={`tm-panel relative ${out ? "opacity-60" : ""}`}>
              <FrameCorners />
              {/* Tap photo or name → BIG detail view with full description */}
              <button
                onClick={() => setDetailItem(m)}
                className="relative w-full cursor-pointer text-left"
                title={t("details")}
              >
                <span className={`tm-photo block m-[5px] mb-0 ${out ? "grayscale-[40%]" : ""}`}>
                  <img src={optimizeImageUrl(m.imageUrl, 400, 250)} alt={menuText(m.name)} loading="lazy" decoding="async" className="h-28 object-cover bg-[#e8dcc0]" onError={(e) => { const el = e.currentTarget; if (!el.src.includes("placeholder")) el.src = FALLBACK_FOOD_IMAGE; }} />
                </span>
                <span className="absolute bottom-2 right-2 rounded-full border border-[#b8955a]/70 bg-[#241710]/85 px-2 py-0.5 text-[9px] font-bold text-[#d8b97e] backdrop-blur-sm">
                  🔍 {t("details")}
                </span>
                {out && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#8f3b2c] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#fdf3e0]">
                    {t("out_of_stock")}
                  </span>
                )}
              </button>
              <div className="space-y-1.5 p-3">
                <button onClick={() => setDetailItem(m)} className="w-full text-left">
                  <p className="tm-dish-name line-clamp-2 min-h-[2.1rem] text-[13px] leading-tight transition-colors hover:text-[#9a4e32]">
                    {menuText(m.name)}
                  </p>
                </button>
                <p className="text-[10px] leading-snug text-[#6d563f] line-clamp-2">{menuText(m.description)}</p>
                <div className="flex items-center justify-between gap-1 pt-1">
                  {(() => {
                    const ep = effectivePrice(m);
                    return ep.onSale ? (
                      <span className="flex flex-col leading-none">
                        <span className="text-[10px] font-semibold text-[#a08567] line-through">{m.price} ETB</span>
                        <span className="text-sm font-extrabold text-[#45653f]">{ep.price} ETB <span className="rounded bg-[#45653f] px-1.5 py-0.5 text-[9px] font-extrabold text-[#fdf3e0]">{t("sale")}</span></span>
                      </span>
                    ) : (
                      <span className="text-sm font-extrabold text-[#9a4e32]">{m.price} ETB</span>
                    );
                  })()}
                  {out ? (
                    <span className="text-[10px] font-bold text-[#a08567]">—</span>
                  ) : qty > 0 ? (
                  // Inline −/+ stepper — carved wood controls
                    <div className="flex items-center gap-1 rounded-lg border border-[#b8955a]/40 bg-[#2b1b13] p-1">
                      <button
                        onClick={() => setQty(m, qty - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#241710] text-[#e8d8b5] hover:bg-[#8f3b2c]"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-extrabold text-[#f2e4c6]">{qty}</span>
                      <button
                        onClick={() => setQty(m, qty + 1)}
                        className="tm-btn flex h-7 w-7 items-center justify-center"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setQty(m, 1)}
                      className="tm-btn flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold"
                    >
                      <Plus className="w-3 h-3" /> {t("add")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!menuLoading && filteredMenu.length === 0 && (
          <div className="col-span-2 py-12 text-center text-sm text-[#a98c5f]">
            <Utensils className="mx-auto mb-2 h-8 w-8 text-[#6d563f]" />
            {t("nothing_found")}
          </div>
        )}
      </div>

      {/* ── ITEM DETAIL MODAL — a parchment menu panel ── */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setDetailItem(null)}>
          <div
            className="tm-panel animate-hall-fade max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <FrameCorners />
            <div className="relative m-[5px]">
              <span className="tm-photo block">
                <img src={optimizeImageUrl(detailItem.imageUrl, 600, 400)} alt={menuText(detailItem.name)} className="h-56 w-full object-cover bg-[#e8dcc0] sm:h-64" onError={(e) => { const el = e.currentTarget; if (!el.src.includes("placeholder")) el.src = FALLBACK_FOOD_IMAGE; }} />
              </span>
              <button
                onClick={() => setDetailItem(null)}
                className="absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-[#b8955a]/70 bg-black/60 text-[#f2e4c6] hover:bg-black"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              {detailItem.badge && (
                <span className="absolute left-2.5 top-2.5 rounded-full border border-[#8c6d3c] bg-gradient-to-b from-[#d8b97e] to-[#b8955a] px-3 py-1 text-[10px] font-extrabold uppercase text-[#241407]">
                  {menuText(detailItem.badge)}
                </span>
              )}
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="tm-head flex-1 text-xl font-bold">{menuText(detailItem.name)}</h2>
                  {(() => {
                    const ep = effectivePrice(detailItem);
                    return ep.onSale ? (
                      <span className="flex flex-col items-end leading-none whitespace-nowrap">
                        <span className="text-xs font-semibold text-[#a08567] line-through">{detailItem.price} ETB</span>
                        <span className="tm-head text-xl font-black text-[#45653f]">
                          {ep.price} ETB <span className="rounded bg-[#45653f] px-1.5 py-0.5 text-[10px] font-extrabold align-middle text-[#fdf3e0]">{t("sale")}</span>
                        </span>
                        <span className="mt-0.5 text-[10px] font-bold text-[#45653f]">{t("you_save")} {ep.savings} ETB{detailItem.saleEnd ? ` • ${t("until")} ${detailItem.saleEnd}` : ""}</span>
                      </span>
                    ) : (
                      <span className="tm-head text-xl font-black whitespace-nowrap text-[#9a4e32]">{detailItem.price} ETB</span>
                    );
                  })()}
                </div>
                <OrnamentDivider className="mt-3" />
              </div>

              {/* FULL description — nothing hidden */}
              <div>
                <p className="tm-eyebrow mb-1">{t("description")}</p>
                <p className="text-sm leading-relaxed text-[#55402e]">{menuText(detailItem.description)}</p>
              </div>

              {/* ── CULTURAL DISH PANEL — make unfamiliar dishes safe to order ── */}
              {(() => {
                const story = dishStoryFor(detailItem.name);
                if (!story) return null;
                const am = lang === "am";
                return (
                  <div className="tm-panel-wood relative rounded-lg p-4 space-y-3">
                    <span className="pointer-events-none absolute inset-[3px] rounded-md border border-[#b8955a]/40" />
                    <p className="tm-eyebrow tm-eyebrow-gold">
                      {am ? story.regionAm : story.region}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <SpiceMeter level={story.spice} lang={lang} />
                      {story.raw && <DishFlag kind="raw" lang={lang} />}
                      {story.fasting && <DishFlag kind="fasting" lang={lang} />}
                      {!story.fasting && story.vegetarian && <DishFlag kind="vegetarian" lang={lang} />}
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-[#a98c5f]">
                        {am ? "እንዴት ይበላል" : "How to eat it"}
                      </p>
                      <p className="text-sm leading-relaxed text-[#f2e8d5]">
                        {am ? story.howToEatAm : story.howToEat}
                      </p>
                    </div>
                    {story.pairsWith.length > 0 && (
                      <p className="text-xs text-[#ded2bd]">
                        <span className="font-bold text-[#d8b97e]">{am ? "ከእነዚህ ጋር ይስማማል፦" : "Goes with:"}</span>{" "}
                        {story.pairsWith.join(" · ")}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {detailItem.prepTime && (
                  <span className="tm-chip tm-chip-available flex items-center gap-1 px-2.5 py-1 font-bold">
                    ⏱ {detailItem.prepTime}
                  </span>
                )}
                {detailItem.dietaryTags &&
                  detailItem.dietaryTags.split(",").map((t, i) => (
                    <span key={i} className="tm-chip tm-chip-available px-2.5 py-1 font-bold">
                      ✓ {menuText(t.trim())}
                    </span>
                  ))}
              </div>

              {detailItem.isAvailable ? (
                <div className="flex items-center gap-3 border-t border-[#b8955a]/30 pt-3">
                  {cartQty(detailItem.id) > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[#b8955a]/40 bg-[#2b1b13] p-1.5">
                      <button onClick={() => setQty(detailItem, cartQty(detailItem.id) - 1)} className="tm-btn-dimm flex h-10 w-10 items-center justify-center" aria-label="Decrease">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center text-lg font-extrabold text-[#f2e4c6]">{cartQty(detailItem.id)}</span>
                      <button onClick={() => setQty(detailItem, cartQty(detailItem.id) + 1)} className="tm-btn flex h-10 w-10 items-center justify-center" aria-label="Increase">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setQty(detailItem, 1)}
                      className="tm-btn-gold flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-black uppercase"
                    >
                      <Plus className="w-4 h-4" /> {t("add_to_order")} — {effectivePrice(detailItem).price} ETB
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-t border-[#b8955a]/30 pt-3">
                  <span className="block rounded-lg bg-[#8f3b2c] py-3 text-center text-sm font-bold text-[#fdf3e0]">{t("out_of_stock")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BELOW-MENU CONTENT (customers scroll while waiting) ═══════════ */}
      <div className="mx-auto max-w-lg space-y-10 px-4 mt-10">

        {/* 3. ABOUT US — short, 2–3 sentences */}
        <section className="tm-panel relative p-5">
          <FrameCorners />
          <h3 className="tm-head flex items-center gap-2 text-lg font-bold">{t("about_us")}</h3>
          <OrnamentDivider className="my-2.5" />
          <p className="text-sm leading-relaxed text-[#55402e] mt-1">
            {menuText(
              settings.about_description?.split(".").slice(0, 2).join(".") ||
                RESTAURANT.identity.story
            )}
          </p>
        </section>

        {/* 4. GALLERY — photos to browse while waiting (tap to open the viewer) */}
        {galleryPhotos.length > 0 && (
          <section>
            <h3 className="tm-head tm-head-dark flex items-center gap-2 text-lg font-bold">
              <Camera className="w-5 h-5 text-[#b8955a]" /> {t("gallery")}
            </h3>
            <OrnamentDivider tone="dark" className="my-2.5" />
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.slice(0, 6).map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="tm-photo group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8955a]"
                  aria-label={`${t("gallery")}: ${menuText(g.title)}`}
                >
                  <img src={optimizeImageUrl(g.imageUrl, 300, 200)} alt={menuText(g.title)} className="h-24 object-cover transition group-hover:opacity-80" loading="lazy" onError={(e) => { const el = e.currentTarget; if (!el.src.includes("placeholder")) el.src = FALLBACK_FOOD_IMAGE; }} />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                    <Search className="w-5 h-5" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 5. SERVICES — very short */}
        <section className="tm-panel-wood relative p-5">
          <span className="pointer-events-none absolute inset-[5px] rounded-lg border border-[#b8955a]/40" />
          <FrameCorners className="z-10" />
          <h3 className="tm-head tm-head-dark text-lg font-bold mb-3">{t("what_we_serve")}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[t("premium_coffee"), t("ethiopian_meals"), t("fresh_pastries"), t("fresh_juices")].map((s) => (
              <div key={s} className="tm-chip rounded-lg px-3 py-2.5 text-center font-bold text-[#e8d8b5]">
                {s}
              </div>
            ))}
          </div>
        </section>

        {/* 6. FIND US — map, address, phone, hours (customers save/share) */}
        <section className="tm-panel relative space-y-3 p-5">
          <FrameCorners />
          <h3 className="tm-head flex items-center gap-2 text-lg font-bold">
            <MapPin className="w-5 h-5 text-[#9a4e32]" /> {t("find_us")}
          </h3>
          <iframe
            title={`${brandName} — ${t("find_us")}`}
            src={`https://maps.google.com/maps?q=${mapsQuery}&z=17&output=embed`}
            className="tm-photo h-44 w-full"
            loading="lazy"
          />
          <div className="space-y-1.5 text-xs text-[#55402e]">
            <p>📍 {menuText(address)}</p>
            <p>📞 <a href={`tel:${phoneHref}`} className="font-extrabold text-[#9a4e32]">{phone}</a></p>
            <p>🕒 {menuText(hours)}</p>
            <p className="text-[#8a7257]">Plus Code: {plusCode}</p>
          </div>
          <a
            href={RESTAURANT.contact.social.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="tm-btn block py-2.5 text-center text-xs font-bold"
          >
            {t("open_maps")}
          </a>
        </section>

        {/* 7. REVIEWS — 3–5 recent + leave a review */}
        <section className="space-y-3">
          <h3 className="tm-head tm-head-dark flex items-center gap-2 text-lg font-bold">
            <Star className="h-5 w-5 fill-[#b8955a] text-[#b8955a]" /> {t("what_guests_say")}
          </h3>
          <OrnamentDivider tone="dark" className="my-2.5" />
          {approvedReviews.map((r) => (
            <div key={r.id} className="tm-panel relative p-4">
              <FrameCorners />
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#2e1d12]">{r.customerName}</p>
                <span className="text-xs font-bold text-[#b8955a]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              <p className="mt-1.5 text-xs italic leading-relaxed text-[#6d563f]">"{menuText(r.reviewText)}"</p>
            </div>
          ))}

          {/* leave a review — inline quick form */}
          <div className="tm-panel-wood relative space-y-3 p-5">
            <span className="pointer-events-none absolute inset-[5px] rounded-lg border border-[#b8955a]/40" />
            <FrameCorners className="z-10" />
            <p className="flex items-center gap-2 text-sm font-bold text-[#f2e4c6]">
              <MessageSquare className="h-4 w-4 text-[#b8955a]" /> {t("leave_review")}
            </p>
            <input
              value={revName}
              onChange={(e) => setRevName(e.target.value)}
              placeholder={t("your_name_ph")}
              className="tm-input w-full px-3 py-2.5 text-xs"
            />
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRevRating(n)}
                  className={`text-xl transition ${n <= revRating ? "text-[#d8b97e]" : "text-[#8a7257]"}`}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={revText}
              onChange={(e) => setRevText(e.target.value)}
              placeholder={t("review_q_ph")}
              className="tm-input w-full px-3 py-2.5 text-xs"
            />
            {revMsg && <p className="text-[11px] font-bold text-[#d8b97e]">{revMsg}</p>}
            <button
              onClick={submitReview}
              disabled={revSending}
              className="tm-btn-gold w-full py-3 text-xs font-black uppercase disabled:opacity-50"
            >
              {revSending ? t("sending") : t("submit_review")}
            </button>
            <p className="text-center text-[10px] text-[#ded2bd]">{t("reviews_note")}</p>
          </div>
        </section>
      </div>

      {/* 8. FOOTER — phone + official social links (client-approved URLs only) */}
      <footer className="mt-10 boundary border-t border-[#b8955a]/25 bg-[#160e09] pb-24 pt-8 text-[#a98c5f]">
        <div className="text-[#b8955a]/35" aria-hidden="true">
          <TibebBand height={10} />
        </div>
        <div className="mx-auto max-w-lg space-y-4 px-4 pt-5 text-center">
          <MesobSeal src={logoUrl} alt={brandName} size={52} />
          <p className="tm-head tm-head-dark text-sm font-semibold">{menuText(brandName)}</p>
          <a href={`tel:${phoneHref}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#d8b97e]">
            <Phone className="w-4 h-4" /> {phone}
          </a>
          <div className="flex items-center justify-center gap-3 pt-1">
            <a href={RESTAURANT.contact.social.facebook} target="_blank" rel="noreferrer" className="tm-chip flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition hover:border-[#d8b97e]">
              <Globe className="w-3.5 h-3.5 text-[#b8955a]" /> Facebook
            </a>
            <a href={RESTAURANT.contact.social.instagram} target="_blank" rel="noreferrer" className="tm-chip flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition hover:border-[#d8b97e]">
              <Camera className="w-3.5 h-3.5 text-[#b8955a]" /> Instagram
            </a>
            <a href={RESTAURANT.contact.social.tiktok} target="_blank" rel="noreferrer" className="tm-chip flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition hover:border-[#d8b97e]">
              <Music2 className="w-3.5 h-3.5 text-[#b8955a]" /> TikTok
            </a>
          </div>
          <p className="pt-2 text-[10px] text-[#8a7257]">
            © {new Date().getFullYear()} {brandName} • {plusCode}
          </p>
          <div className="tm-panel-wood rounded-lg px-3 py-2.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#b8955a]">Powered by AB Web</p>
            <a href="tel:+251919081802" className="text-[11px] font-bold text-[#ded2bd] hover:text-[#d8b97e]">
              📞 +251 91 908 1802 — AB Web · Digital Menus & Websites
            </a>
          </div>
        </div>
      </footer>

      {/* ═══════════ GALLERY LIGHTBOX — close + previous/next arrows ═══════════ */}
      {lightboxIndex !== null && galleryPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("gallery")}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label={t("close")}
            className="absolute top-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#b8955a]/60 bg-white/10 text-white transition hover:bg-white/25"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
            aria-label={t("previous")}
            className="absolute left-2 sm:left-5 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#b8955a]/60 bg-white/10 text-white transition hover:bg-white/25"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); stepLightbox(1); }}
            aria-label={t("next")}
            className="absolute right-2 sm:right-5 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#b8955a]/60 bg-white/10 text-white transition hover:bg-white/25"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <figure className="max-w-4xl w-full max-h-[80vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <span className="tm-photo block">
              <img
                key={galleryPhotos[lightboxIndex].id}
                src={optimizeImageUrl(galleryPhotos[lightboxIndex].imageUrl, 1280, 900)}
                alt={menuText(galleryPhotos[lightboxIndex].title)}
                className="max-h-[64vh] w-auto max-w-full object-contain"
                onClick={closeLightbox}
                onError={(e) => { const el = e.currentTarget; if (!el.src.includes("placeholder")) el.src = FALLBACK_FOOD_IMAGE; }}
              />
            </span>
            <figcaption className="mt-5 text-center px-6">
              <p className="tm-head tm-head-dark text-sm font-bold">{menuText(galleryPhotos[lightboxIndex].title)}</p>
              {galleryPhotos[lightboxIndex].caption && (
                <p className="mt-1 text-xs text-[#ded2bd]">{menuText(galleryPhotos[lightboxIndex].caption)}</p>
              )}
              <p className="mt-2 text-[11px] font-black tracking-widest text-[#b8955a]">
                {lightboxIndex + 1} / {galleryPhotos.length}
              </p>
            </figcaption>
          </figure>
        </div>
      )}

      {/* cart bar — carved-wood tray */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[#b8955a]/70 bg-[#241710]/95 backdrop-blur-md">
          <div className="text-[#b8955a]/40" aria-hidden="true">
            <TibebBand height={8} />
          </div>
          <div className="tm-texture-through mx-auto flex max-w-lg items-center gap-3 p-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a98c5f]">{cartCount} {t("items_label")}</p>
              <p className="tm-head tm-engraved text-xl font-black">{cartTotal} ETB</p>
            </div>
            <button
              onClick={() => setReviewMode(true)}
              className="tm-btn-gold flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-black uppercase"
            >
              <CoffeeIcon className="w-4 h-4" /> {t("review_order")}
            </button>
          </div>
        </div>
      )}

      {/* ── CALL-WAITER TOAST ── */}
      {callToast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-ontime px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-hall)] animate-hall-fade">
          {callToast}
        </div>
      )}

      {/* ── CALL-WAITER SHEET — carved wood panel ── */}
      {callOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setCallOpen(false)}
        >
          <div
            className="tm-panel-wood w-full max-w-lg animate-hall-fade rounded-t-2xl p-5 pb-8 text-ivory"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <span className="pointer-events-none absolute inset-[5px] rounded-lg border border-[#b8955a]/40" />
            <FrameCorners className="z-10" />
            <div className="mb-4 flex items-center justify-between">
              <p className="tm-head tm-head-dark flex items-center gap-2 text-lg font-semibold">
                <JebenaMark className="h-5 w-5 text-[#b8955a]" />
                {lang === "am" ? "እርዳታ ያስፈልጋል?" : "Need something?"}
              </p>
              <button
                type="button"
                onClick={() => setCallOpen(false)}
                className="tm-btn-ghost flex h-8 w-8 items-center justify-center"
                aria-label="Close"
              >
                <CloseX className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { kind: "waiter", icon: HandHelping, en: "Call waiter", am: "ሰርቨር ጥራ" },
                { kind: "bill", icon: Receipt, en: "Bill please", am: "ሂሳብ" },
                { kind: "injera", icon: Croissant, en: "More injera", am: "ተጨማሪ እንጀራ" },
                { kind: "coffee", icon: CoffeeIcon, en: "Coffee", am: "ቡና" },
                { kind: "drinks", icon: Wine, en: "Order drinks", am: "መጠጥ" },
                { kind: "celebration", icon: PartyPopper, en: "Celebration", am: "በዓል" },
              ].map(({ kind, icon: Icon, en, am }) => (
                <button
                  key={kind}
                  type="button"
                  disabled={callSending === kind}
                  onClick={() => sendServiceCall(kind)}
                  className="tm-chip flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition hover:border-[#d8b97e] disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[#b8955a]" />
                  {lang === "am" ? am : en}
                </button>
              ))}
            </div>
            {/* Self-service: this page IS the ordering screen. */}
            <button
              type="button"
              onClick={() => setCallOpen(false)}
              className="tm-btn-gold mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold"
            >
              <Utensils className="h-4 w-4" />
              {lang === "am" ? "ተጨማሪ ትዕዝ አክል" : "Place another order"}
            </button>

            <p className="mt-4 text-center text-[11px] text-[#ded2bd]">
              {lang === "am"
                ? "ጥያቄዎ በቀጥ ወደ ርቨሮች ማሳያ ይደርሳል።"
                : "Your request goes straight to the waiter screen — no waving needed."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
