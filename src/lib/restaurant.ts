/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RESTAURANT CONFIGURATION LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This is the single source of truth for "which restaurant are we running?".
 *
 *  The operational engine (QR ordering → waiter → kitchen/barista → cashier →
 *  reports) is restaurant-agnostic. Everything that makes a venue feel like
 *  ITSELF — name, colours, cultural pack, dishes, tonight's programme, feast
 *  packages, the story behind the food — lives here.
 *
 *  To onboard a new traditional restaurant you do NOT fork the codebase:
 *  you swap this config (or, later, load the same shape from `site_settings`).
 *
 *  Currently: Totot Traditional Food Hall | Gerji | ቶቶት | ገርጂ
 */

export type CulturePack =
  | "gurage"      // Southern Ethiopian — kitfo, kocho, areqe (Totot's heritage)
  | "amhara"      // doro wat, injera, tej, begena
  | "oromo"       // buna qalaa, marqa, siinqee motifs
  | "tigray"      // tsebhi, hilbet, shiro
  | "southern"    // pan-Southern Nations
  | "modern-cafe";

export interface RestaurantIdentity {
  /** Latin-script name. */
  name: string;
  /** Amharic name — rendered FIRST in cultural moments. */
  nameAm: string;
  /** Short mark used on QR table cards, receipts, favicons. */
  shortName: string;
  /** Legal/brand-guarded name returned by fixBrandText(). */
  brandName: string;
  tagline: string;
  taglineAm: string;
  culturePack: CulturePack;
  /** The one-sentence story that gives the interface meaning. */
  story: string;
  storyAm: string;
  /** Name etymology — real, verifiable, not invented decoration. */
  nameOrigin: { text: string; textAm: string };
}

export interface RestaurantContact {
  phone: string;
  phoneDisplay: string;
  address: string;
  addressAm: string;
  plusCode: string;
  lat: string;
  lng: string;
  website: string;
  googleRating: string;
  googleReviewCount: string;
  /** Totot is a 24-hour hall — that alone changes the UI ("Open now" always). */
  hoursNote: string;
  hoursNoteAm: string;
}

export interface DesignTokens {
  /** Page background — a cultural hall at night. */
  obsidian: string;
  /** Deeper than obsidian: footer, hero scrim. */
  night: string;
  /** Card / secondary surface. */
  coffee: string;
  /** Text on dark, and background on light sections. */
  ivory: string;
  /** Clay-red accent — the primary action colour. */
  terracotta: string;
  /** Woven-gold highlight — hairlines, active states, prices. */
  gold: string;
  /** National colours, used as tiny accents only (never as the palette). */
  flag: { green: string; yellow: string; red: string };
}

/** One event in "Tonight at …" — the cultural programme the guest sees. */
export interface ExperienceEvent {
  id: string;
  /** lucide-react icon name. */
  icon: string;
  title: string;
  titleAm: string;
  time: string;          // display time, e.g. "19:45"
  durationMin: number;   // used for the timeline bar + readiness maths
  kind: "music" | "dance" | "coffee" | "special" | "show";
  description: string;
  descriptionAm: string;
  /** True when guests can join the stage (Totot's signature draw). */
  participatory: boolean;
  activeTonight: boolean;
  /** Owner-uploaded photo (/api/images/{id}), optional. */
  image?: string;
}

/** A curated "Share the Table" package — an average-order-value lever. */
export interface FeastPackage {
  id: string;
  slug: string;
  name: string;
  nameAm: string;
  serves: number;
  price: number;
  /** Sum of à-la-carte items, so the saving badge is computed not typed. */
  alaCarte: number;
  icon: string;
  blurb: string;
  blurbAm: string;
  items: string[];
  /** Highlights this package on the QR page and the homepage. */
  featured: boolean;
  /** Owner-uploaded photo (/api/images/{id}), optional. */
  image?: string;
}

/** Dish-level cultural metadata the QR menu uses to de-risk new dishes. */
export interface DishStory {
  /** Menu item name (exact, case-insensitive match). */
  dish: string;
  region: string;
  regionAm: string;
  story: string;
  storyAm: string;
  /** How to eat it — the single most useful thing for a first-time guest. */
  howToEat: string;
  howToEatAm: string;
  /** 0–3. 0 = mild, 3 = "Gurage hot". */
  spice: 0 | 1 | 2 | 3;
  /** Raw preparations are a real concern for some guests — label them. */
  raw: boolean;
  /** Ethiopic Orthodox fasting food (no animal product) — a whole market. */
  fasting: boolean;
  vegetarian: boolean;
  /** Ordered-with suggestions (the tasteful upsell, max 1–2 shown). */
  pairsWith: string[];
  /** Owner-uploaded photo (/api/images/{id}), optional. */
  image?: string;
}

export interface RestaurantConfig {
  identity: RestaurantIdentity;
  contact: RestaurantContact;
  tokens: DesignTokens;
  tonight: ExperienceEvent[];
  packages: FeastPackage[];
  dishStories: DishStory[];
  modules: {
    liveEntertainment: boolean;
    coffeeCeremony: boolean;
    buffet: boolean;
    reservations: boolean;
    delivery: boolean;
    takeaway: boolean;
    touristMode: boolean;
    groupFeasts: boolean;
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/*  TOTOT TRADITIONAL FOOD HALL                                             */
/* ───────────────────────────────────────────────────────────────────────── */

export const TOTOT: RestaurantConfig = {
  identity: {
    name: "Totot Traditional Food Hall",
    nameAm: "ቶቶት ባህላዊ ምግብ ቤት",
    shortName: "TOTOT",
    brandName: "Totot Traditional Food Hall",
    tagline: "Order the food. Discover the culture. Join the celebration.",
    taglineAm: "ምግቡን ይዘዙ። ባህሉን ያግኙ። በበዓሉ ይሳተፉ።",
    culturePack: "gurage",
    story:
      "Totot is a 24-hour cultural hall in Gerji built around Southern Ethiopian cooking — kitfo pounded with mitmita and niter kibbeh, kocho, gomen and ayib — served on shared platters while live bands play Guragegna, Gojam, Tigrigna and Oromigna and guests walk up to dance.",
    storyAm:
      "ቶቶት በገርጂ የሚገኝ 24 ሰዓት የሚሰራ ባህላዊ የምግብ አዳራሽ ነው። የደቡብ ኢትዮጵያ ምግቦች — በመጥመጣና በንጥር ቅቤ የተሰራ ክትፎ፣ ቆጮ፣ ጎመንና አይብ — በጋራ ሳህን ይቀርባሉ፤ በዚህም ወቅት ቀጥታ ባንዶች ጉራጌኛ፣ ጎጃም፣ ትግርኛና ኦሮምኛ ዘፈኖችን ያቀርባሉ፣ እንግዶችም ወደ መድረክ ወጥተው ይጨፍራሉ።",
    nameOrigin: {
      text: "“Totot” comes from the Gurage language and means “let’s work” — the hall is named for the shared labour of cooking, serving and celebrating together.",
      textAm: "«ቶቶት» የመጣው ከጉራጌ ቋንቋ ሲሆን ትርጉሙም «እንስራ» ማለት ነው። አዳራሹ ስሙን ያገኘው ከማብሰል፣ ከማቅረብና ከአንድ ላይ ከማክበር የጋራ ጥረት ነው።",
    },
  },

  contact: {
    phone: "+251116460718",
    phoneDisplay: "011 646 0718",
    address:
      "Anbessa Garage, In Front of World Vision, Gerji Sub City, Addis Ababa",
    addressAm: "አንበሳ ጋራዥ፣ በወርልድ ቪዥን ፊት ለፊት፣ ገርጂ ክፍለ ከተማ፣ አዲስ አበባ",
    plusCode: "2R44+VF Addis Ababa",
    lat: "9.0071273",
    lng: "38.8061996",
    website: "totottraditionalrestaurant.com",
    googleRating: "4.1",
    googleReviewCount: "660",
    hoursNote: "Open 24 hours",
    hoursNoteAm: "24 ሰዓት ክፍት",
  },

  tokens: {
    obsidian: "#171411",
    night: "#0F0D0B",
    coffee: "#4A3025",
    ivory: "#F4EBDD",
    terracotta: "#9A4E32",
    gold: "#B8955A",
    flag: { green: "#2E7D4F", yellow: "#E4B33B", red: "#C0392B" },
  },

  /* "Tonight at Totot" — the programme guests plan their evening around.
     Admin-editable; times are display strings so the owner controls the show. */
  tonight: [
    {
      id: "dinner",
      icon: "Utensils",
      title: "Dinner service",
      titleAm: "የእራት ጊዜ አገልግሎት",
      time: "19:00",
      durationMin: 45,
      kind: "special",
      description: "Shared platters land at the table as the hall fills up.",
      descriptionAm: "አዳራሹ ሲሞላ የጋራ ሳህኖች ወደ ጠረጴዛዎች ይደርሳሉ።",
      participatory: false,
      activeTonight: true,
    },
    {
      id: "music",
      icon: "Music",
      title: "Live traditional band",
      titleAm: "ቀጥታ ባህላዊ ባንድ",
      time: "19:45",
      durationMin: 45,
      kind: "music",
      description: "Guragegna, Gojam, Tigrigna and Oromigna — one band, four traditions.",
      descriptionAm: "ጉራጌኛ፣ ጎጃም፣ ትግርኛና ኦሮምኛ — አንድ ባንድ፣ አራት ባህሎች።",
      participatory: false,
      activeTonight: true,
    },
    {
      id: "dance",
      icon: "Sparkles",
      title: "Traditional dance — join the stage",
      titleAm: "ባህላዊ አሸንዳ ውዝዋዜ — ወደ መድረክ ይውጡ",
      time: "20:15",
      durationMin: 45,
      kind: "dance",
      description:
        "Our dancers will invite your table up. Guests consistently call this the highlight of the night.",
      descriptionAm: "አሸናንፊዎቻችን ጠረጴዛዎን ወደ መድረክ ይጋብዝዎታል። እንግዶች የምሽቱ ዋና ክስተት ብለው የሚጠሩት ይህን ነው።",
      participatory: true,
      activeTonight: true,
    },
    {
      id: "coffee",
      icon: "Coffee",
      title: "Jebena Buna ceremony",
      titleAm: "የጀበና ቡና ስነ-ስርዓት",
      time: "21:00",
      durationMin: 30,
      kind: "coffee",
      description: "Beans roasted at your table, three rounds served the traditional way.",
      descriptionAm: "በጠረጴዛዎ ፊት የተጠበሰ ቡና፣ ሦስት ዙር በባህላዊ ስርዓት ይቀርባል።",
      participatory: true,
      activeTonight: true,
    },
  ],

  /* Revenue lever: sell the table, not the dish. `alaCarte` is real so the
     "save ETB n" badge is calculated rather than typed. */
  packages: [
    {
      id: "pkg-2",
      slug: "cultural-dinner-2",
      name: "Cultural Dinner for Two",
      nameAm: "ባህላዊ እራት ለሁለት ሰው",
      serves: 2,
      price: 1650,
      alaCarte: 1980,
      icon: "Heart",
      blurb: "One shared mesob: kitfo, tibs, gomen, ayib and a jebena of buna.",
      blurbAm: "አንድ የጋራ መሶብ፦ ክትፎ፣ ጥብስ፣ ጎመን፣ አይብና ጀበና ቡና።",
      items: ["Special Kitfo", "Derek Tibs", "Gomen", "Ayib", "Jebena Buna (2)"],
      featured: true,
    },
    {
      id: "pkg-4",
      slug: "totot-feast-4",
      name: "Totot Feast for Four",
      nameAm: "የቶቶት ድግስ ለአራት ሰው",
      serves: 4,
      price: 3450,
      alaCarte: 4180,
      icon: "Users",
      blurb: "The full hall: mixed platter, kitfo, doro wat, veg selection, tej and buna.",
      blurbAm: "ሙሉ አዳራሽ፦ ቅልቅል ሳህን፣ ክትፎ፣ ዶሮ ወጥ፣ የአትክልት ምርጫ፣ ጠጅና ቡና።",
      items: [
        "Mixed Vegetables (Beyaynetu)",
        "Special Kitfo",
        "Doro Wat",
        "Derek Tibs",
        "Tej (Honey Wine)",
        "Jebena Buna (4)",
      ],
      featured: true,
    },
    {
      id: "pkg-group",
      slug: "group-feast-10",
      name: "Group Feast — 10 Guests",
      nameAm: "የቡድን ድግስ — ለ10 እንግዶች",
      serves: 10,
      price: 8900,
      alaCarte: 10450,
      icon: "PartyPopper",
      blurb: "For tours, weddings and conferences. Pre-ordered so service stays fast.",
      blurbAm: "ለቱር ቡድኖች፣ ለሠርግና ለስብሰባዎች። አስቀድሞ ስለሚዘዝ አገልግሎቱ ፈጣን ሆኖ ይቀጥላል።",
      items: [
        "Mixed Vegetables (Beyaynetu) ×2",
        "Special Kitfo ×2",
        "Doro Wat",
        "Shekla Tibs",
        "Gomen & Ayib",
        "Tej ×2",
        "Jebena Buna Ceremony",
      ],
      featured: false,
    },
    {
      id: "pkg-veg",
      slug: "vegetarian-journey",
      name: "Fasting & Vegetarian Journey",
      nameAm: "የጾምና የአትክልት ጉዞ",
      serves: 2,
      price: 980,
      alaCarte: 1180,
      icon: "Leaf",
      blurb: "Shiro, misir, gomen, atkilt, tikil gomen and fresh injera — all fasting-safe.",
      blurbAm: "ሽሮ፣ ምስር፣ ጎመን፣ አትክልት፣ ትክል ጎመንና ትኩስ እንጀራ — ሁሉም ለጾም ተስማሚ።",
      items: ["Shiro Wat", "Misir Wat", "Gomen", "Atkilt Wat", "Ayib", "Fresh Injera"],
      featured: false,
    },
    {
      id: "pkg-kitfo",
      slug: "kitfo-experience",
      name: "The Kitfo Experience",
      nameAm: "የክትፎ ተሞክሮ",
      serves: 2,
      price: 1450,
      alaCarte: 1720,
      icon: "Flame",
      blurb: "Special kitfo, kocho, ayib, gomen and areqe — the Southern Ethiopian table.",
      blurbAm: "ልዩ ክትፎ፣ ቆጮ፣ አይብ፣ ጎመንና አረቄ — የደቡብ ኢትዮጵያ ጠረጴዛ።",
      items: ["Special Kitfo", "Kocho", "Ayib", "Gomen", "Areqe"],
      featured: false,
    },
    {
      id: "pkg-buna",
      slug: "coffee-ceremony",
      name: "Jebena Buna Ceremony",
      nameAm: "የጀበና ቡና ስነ-ስርዓት",
      serves: 4,
      price: 450,
      alaCarte: 560,
      icon: "Coffee",
      blurb: "Roasted at the table, three rounds, popcorn and frankincense.",
      blurbAm: "በጠረጴዛ ፊት የተጠበሰ፣ ሦስት ዙር፣ ፈንድሻና ዕጣን።",
      items: ["Jebena Buna (3 rounds)", "Popcorn", "Frankincense"],
      featured: false,
    },
  ],

  /* Cultural storytelling — makes unfamiliar dishes safe to order. */
  dishStories: [
    {
      dish: "Special Kitfo",
      region: "Gurage Zone, Southern Ethiopia",
      regionAm: "ጉራጌ ዞን፣ ደቡብ ኢትዮጵያ",
      story:
        "Kitfo is the dish Totot is known for. Finely minced beef is worked by hand with mitmita — a fiery orange chilli blend — and niter kibbeh, spiced clarified butter warmed just enough to coat the meat without cooking it. Served raw (tere), lightly warmed (leb leb) or fully cooked.",
      storyAm:
        "ክትፎ ቶቶት የታወቀበት ምግብ ነው። በጥሩ ሁኔታ የተፈጨ ብድር ከመጥመጣ — ብርቱ ከሆነ ቀይ በርበሬ ቅልቅል — እና ከንጥር ቅቤ ጋር በእጅ ተደፍድፎ ይዘጋጃል። በጥሬ (ጠሬ)፣ በትንሽ የተሞቀ (ለብ ለብ) ወይም ሙሉ በሙሉ በተበሰለ መልኩ ይቀርባል።",
      howToEat:
        "Tear a small piece of injera, scoop the kitfo with it, and add a bit of ayib (soft cheese) to cool the heat. Sharing from one plate is the tradition.",
      howToEatAm:
        "ትንሽ እንጀራ ይቀዱ፣ በእሱ ክትፎ ያንሱ፣ ሙቀቱን ለማረጋጋትም ትንሽ አይብ ይጨምሩ። ከአንድ ሳህን አብሮ መብላት ባህሉ ነው።",
      spice: 3,
      raw: true,
      fasting: false,
      vegetarian: false,
      pairsWith: ["Ayib", "Kocho", "Tej (Honey Wine)"],
    },
    {
      dish: "Mixed Vegetables (Beyaynetu)",
      region: "Nationwide — fasting tradition",
      regionAm: "ሀገር አቀፍ — የጾም ባህል",
      story:
        "Beyaynetu means “combination of vegetables”. It grew out of the Ethiopic Orthodox fasting calendar, when no animal product is eaten — so the kitchen learned to build a full meal from legumes and greens alone.",
      storyAm:
        "ብያይነቱ ማለት «የአትክልት ቅልቅል» ማለት ነው። የዳገው የኢትዮጵያ ኦርቶዶክስ የጾም አቆጣጠር ውስጥ የተፈጠረ ሲሆን፣ በዚያን ጊዜ የእንስሳት ምርት ስለማይበላ ሙሉ ምግብ ከዘርና ከአረንጓዴ ቅጠላ ቅጠሎች ብቻ መሥራት ተማሩ።",
      howToEat:
        "Scoop each section separately so you taste every wat on its own, then mix what you like.",
      howToEatAm: "እያንዳንዱን ወጥ ለየብቻ ያንሱ፤ ከዚያ የወደዱትን ያቀላቅሉ።",
      spice: 1,
      raw: false,
      fasting: true,
      vegetarian: true,
      pairsWith: ["Fresh Injera", "Jebena Buna"],
    },
    {
      dish: "Shekla Tibs",
      region: "Highland Ethiopia",
      regionAm: "የደጋማ ኢትዮጵያ",
      story:
        "Shekla means clay pot. Cubes of beef are seared with rosemary, garlic and awaze, then brought to the table still crackling on a clay dish over coals — the flame is part of the dish, and part of the room.",
      storyAm:
        "ሸክላ ማለት የሸክላ ምድጃ ነው። የብድር ቁርጥራጮች በሮዝሜሪ፣ በነጭ ሽንኩርትና በአዋዜ ተጠብሰው፣ በሸክላ ሳህን ላይ እየተጫጫሩ በከሰል ላይ ይቀርባሉ — ነበልባሉ የምግቡም የአዳራሹም አካል ነው።",
      howToEat:
        "Eat it straight from the hot clay while it sizzles. Ask for awaze on the side if you want more heat.",
      howToEatAm: "በሸክላው ላይ እየተጫጨረ ሳለ በቀጥታ ይብሉት። ተጨማሪ ቅመም ከፈለጉ አዋዜ ለየብቻ ይጠይቁ።",
      spice: 2,
      raw: false,
      fasting: false,
      vegetarian: false,
      pairsWith: ["Tej (Honey Wine)", "Ayib"],
    },
    {
      dish: "Doro Wat",
      region: "Amhara & Shewa",
      regionAm: "አማራና ሸዋ",
      story:
        "The celebratory chicken stew. Onions are cooked down for over an hour before berbere and niter kibbeh are added — that patience is the whole recipe. Served with a hard-boiled egg for each guest.",
      storyAm:
        "የበዓል የዶሮ ወጥ። ሽንኩርቱ ከአንድ ሰዓት በላይ ከተቀላጠፈ በኋላ በርበሬና ንጥር ቅቤ ይጨመራል — ትዕግስቱ ራሱ የአሠራሩ ምስጢር ነው። ለእያንዳንዱ እንግዳ አንድ የተቀቀለ እንቁላል ተጨምሮ ይቀርባል።",
      howToEat:
        "Tear injera, scoop the sauce and the onion, and take the egg last — it is the guest's portion.",
      howToEatAm: "እንጀራ ቀድተው ሶስና ሽንኩርት ያንሱ፤ እንቁላሉን በመጨረሻ ይውሰዱ — የእንግዳው ድርሻ ነው።",
      spice: 2,
      raw: false,
      fasting: false,
      vegetarian: false,
      pairsWith: ["Tej (Honey Wine)", "Fresh Injera"],
    },
    {
      dish: "Tej (Honey Wine)",
      region: "Nationwide",
      regionAm: "ሀገር አቀፍ",
      story:
        "Honey wine fermented with gesho leaves, served in a berele — a round flask with a long neck. Sweet on the first sip, sharp after. Totot brews its own batches, which is why it occasionally runs out mid-evening.",
      storyAm:
        "በገሾ ቅጠል የተፈራ የማር ወይን፣ በበረለ — ረጅም አንገት ባለው ክብ ብርጭቆ — ይቀርባል። በመጀመሪያው ቅምሻ ጣፋጭ፣ ከዚያ በኋላ የተበረታ ነው። ቶቶት የራሱን ጠጅ ይሰራል፤ ለዚህም ነው አልፎ አልፎ በምሽት የሚያልቅበት።",
      howToEat: "Sip slowly from the berele between dishes. It pairs with everything spicy.",
      howToEatAm: "በምግቦች መካከል ከበረለው ቀስ ብለው ይጠጡ። ከሁሉም ቅመማ ምግብ ጋር ይስማማል።",
      spice: 0,
      raw: false,
      fasting: false,
      vegetarian: true,
      pairsWith: ["Special Kitfo", "Shekla Tibs"],
    },
  ],

  modules: {
    liveEntertainment: true,
    coffeeCeremony: true,
    buffet: true,
    reservations: true,
    delivery: true,
    takeaway: true,
    touristMode: true,
    groupFeasts: true,
  },
};

/** Active restaurant. Swap this (or read it from site_settings) to rebrand. */
export const RESTAURANT: RestaurantConfig = TOTOT;

/* ───────────────────────────────────────────────────────────────────────── */
/*  Convenience selectors                                                   */
/* ───────────────────────────────────────────────────────────────────────── */

/** The dish story for a menu item name, if we have one. */
export function dishStoryFor(name: string): DishStory | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return RESTAURANT.dishStories.find((d) => d.dish.toLowerCase() === key);
}

/** Packages worth showing on the QR page (the rest live on the website). */
export function featuredPackages(limit = 3): FeastPackage[] {
  const featured = RESTAURANT.packages.filter((p) => p.featured);
  const pool = featured.length >= limit ? featured : RESTAURANT.packages;
  return pool.slice(0, limit);
}

/** Savings badge copy for a package. */
export function packageSaving(p: FeastPackage): number {
  return Math.max(0, p.alaCarte - p.price);
}

/** "Open now" logic — Totot never closes, but this stays honest for others. */
export function isOpenNow(date = new Date()): boolean {
  if (/24\s*hours?/i.test(RESTAURANT.contact.hoursNote)) return true;
  const h = date.getHours();
  return h >= 9 || h < 2;
}
