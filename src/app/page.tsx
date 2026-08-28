"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TOTOT — CULTURAL HOMEPAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *  Order of the story:
 *    1. Hero — welcome to the table (Amharic leads, one verb: explore the feast)
 *    2. Tonight at Totot — the programme guests plan their evening around
 *    3. Menu — photographic, spice-honest, ordering lives on the QR page
 *    4. Share the Table — feast packages (the average-order-value lever)
 *    5. The Story Behind the Food — name origin + dish storytelling
 *    6. Visit — address, plus code, hours, map
 *
 *  Data comes from the API; if there is no database yet (fresh deploy / local
 *  preview) the Totot demo menu stands in so the design is never empty.
 */

import { useEffect, useState, useCallback } from "react";
import { MenuItem, Category, SiteSettings } from "@/types";
import { TOTOT_CATEGORIES, TOTOT_MENU_ITEMS } from "@/lib/totot-demo";

import HeroSection from "@/components/HeroSection";
import TonightSection from "@/components/cultural/TonightSection";
import CulturalMenuSection from "@/components/cultural/CulturalMenuSection";
import FeastPackagesSection from "@/components/cultural/FeastPackagesSection";
import StorySection from "@/components/cultural/StorySection";
import VisitSection from "@/components/cultural/VisitSection";
import CulturalFooter from "@/components/cultural/CulturalFooter";
import LanguageToggle from "@/components/LanguageToggle";

export default function HomePage() {
  const [settings] = useState<SiteSettings>({} as SiteSettings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [catRes, menuRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/menu"),
      ]);

      let cats: Category[] = [];
      let items: MenuItem[] = [];

      if (catRes.ok) {
        const c = await catRes.json();
        if (Array.isArray(c) && c.length > 0) cats = c;
      }
      if (menuRes.ok) {
        const m = await menuRes.json();
        if (Array.isArray(m) && m.length > 0) items = m;
      }

      // Design fallback: no DB yet → show the Totot demo menu, never a void.
      if (items.length === 0) {
        setMenuItems(TOTOT_MENU_ITEMS);
        setCategories(TOTOT_CATEGORIES);
      } else {
        setMenuItems(items);
        setCategories(cats.length ? cats : TOTOT_CATEGORIES);
      }
    } catch {
      setMenuItems(TOTOT_MENU_ITEMS);
      setCategories(TOTOT_CATEGORIES);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetch("/api/admin/verify")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setIsAdminLoggedIn(true);
      })
      .catch(() => {});
  }, [loadData]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const goToAdmin = () => {
    window.location.href = "/admin";
  };

  const openOrdering = () => {
    // QR ordering without a table → the customer menu.
    window.location.href = "/menu";
  };

  void settings;
  void isAdminLoggedIn;

  return (
    <div className="min-h-screen bg-obsidian text-ivory font-body selection:bg-gold selection:text-obsidian">
      <LanguageToggle />

      <main>
        <HeroSection onOpenMenu={openOrdering} onOpenSection={scrollTo} />
        <TonightSection />
        <CulturalMenuSection items={menuItems} categories={categories} onOrder={openOrdering} />
        <FeastPackagesSection />
        <StorySection />
        <VisitSection />
      </main>

      <CulturalFooter onAdmin={goToAdmin} />
    </div>
  );
}
