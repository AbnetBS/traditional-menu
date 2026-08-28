/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TOTOT DEMO MENU
 * ═══════════════════════════════════════════════════════════════════════════
 *  A design-time fallback so the cultural homepage, tonight's strip and the QR
 *  page render richly before a database is attached. This mirrors what the
 *  seed (ensureDbSeeded) would insert for a fresh Totot database.
 *
 *  Once the DB is live the API responses take over and this is never shown.
 */

import { MenuItem, Category } from "@/types";

export const TOTOT_CATEGORIES: Category[] = [
  { id: 1, name: "All Items", slug: "all", icon: "Utensils", sortOrder: 0 },
  { id: 2, name: "Signature & Raw", slug: "signature-raw", icon: "Flame", sortOrder: 1 },
  { id: 3, name: "Traditional Mains", slug: "traditional-mains", icon: "Utensils", sortOrder: 2 },
  { id: 4, name: "Fasting & Vegetarian", slug: "fasting-veg", icon: "Leaf", sortOrder: 3 },
  { id: 5, name: "Honey Wine & Drinks", slug: "drinks", icon: "Wine", sortOrder: 4 },
  { id: 6, name: "Buna & Ceremony", slug: "buna", icon: "Coffee", sortOrder: 5 },
];

export const TOTOT_MENU_ITEMS: MenuItem[] = [
  {
    id: 101,
    name: "Special Kitfo",
    category: "signature-raw",
    price: 850,
    description:
      "Finely minced beef worked with mitmita and warm niter kibbeh. Choose tere (raw), leb leb (warmed) or fully cooked. Served with ayib and gomen.",
    imageUrl: "/images/kitfo.jpg",
    isPopular: true,
    isAvailable: true,
    dietaryTags: "Gurage, Raw option",
    prepTime: "12 min",
    badge: "Signature",
    sortOrder: 1,
  },
  {
    id: 102,
    name: "Shekla Tibs",
    category: "traditional-mains",
    price: 780,
    description:
      "Cubes of beef seared with rosemary, garlic and awaze, served still crackling on a hot clay dish over coals.",
    imageUrl: "https://images.pexels.com/photos/6419328/pexels-photo-6419328.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=480",
    isPopular: true,
    isAvailable: true,
    dietaryTags: "Highland",
    prepTime: "18 min",
    badge: "Served sizzling",
    sortOrder: 2,
  },
  {
    id: 103,
    name: "Doro Wat",
    category: "traditional-mains",
    price: 720,
    description:
      "Slow-simmered chicken stew with a base of onions cooked for over an hour, berbere and niter kibbeh. Served with a hard-boiled egg.",
    imageUrl: "https://images.pexels.com/photos/7135933/pexels-photo-7135933.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=480",
    isPopular: false,
    isAvailable: true,
    dietaryTags: "Amhara, Celebratory",
    prepTime: "20 min",
    badge: "",
    sortOrder: 3,
  },
  {
    id: 104,
    name: "Mixed Vegetables (Beyaynetu)",
    category: "fasting-veg",
    price: 420,
    description:
      "A fasting-safe platter of shiro, misir, gomen, atkilt and tikil gomen over fresh injera. Built from the Orthodox fasting tradition.",
    imageUrl: "/images/hero-hall.jpg",
    isPopular: true,
    isAvailable: true,
    dietaryTags: "Fasting, Vegetarian",
    prepTime: "10 min",
    badge: "Fasting safe",
    sortOrder: 4,
  },
  {
    id: 105,
    name: "Tej (Honey Wine)",
    category: "drinks",
    price: 250,
    description:
      "House-fermented honey wine with gesho, served in a berele. Sweet on the first sip, sharp after. Pairs with everything spicy.",
    imageUrl: "https://images.pexels.com/photos/5440994/pexels-photo-5440994.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=480",
    isPopular: true,
    isAvailable: true,
    dietaryTags: "House-brewed",
    prepTime: "3 min",
    badge: "In a berele",
    sortOrder: 5,
  },
  {
    id: 106,
    name: "Jebena Buna Ceremony",
    category: "buna",
    price: 300,
    description:
      "Beans roasted at your table and served in three rounds with popcorn and frankincense. The ceremony, not just the cup.",
    imageUrl: "/images/coffee-ceremony.jpg",
    isPopular: true,
    isAvailable: true,
    dietaryTags: "Ceremony",
    prepTime: "30 min",
    badge: "At your table",
    sortOrder: 6,
  },
];
