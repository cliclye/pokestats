import type { RetailerSlug, TrackedProduct } from "../types";

/** Big-box / official channels that typically sell sealed product near MSRP. */
export const MSRP_RETAILERS: RetailerSlug[] = [
  "target",
  "walmart",
  "best-buy",
  "gamestop",
  "pokemon-center",
];

export const MSRP_RETAILER_LABELS: Record<string, string> = {
  target: "Target",
  walmart: "Walmart",
  "best-buy": "Best Buy",
  gamestop: "GameStop",
  "pokemon-center": "Pokémon Center",
};

export function isMsrpRetailer(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return (MSRP_RETAILERS as string[]).includes(slug);
}

export type ProductCategory =
  | "etb"
  | "booster_bundle"
  | "booster_box"
  | "tin"
  | "collection"
  | "battle_deck"
  | "other";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  etb: "Elite Trainer Box",
  booster_bundle: "Booster Bundle",
  booster_box: "Booster Box",
  tin: "Tin",
  collection: "Collection / Specialty",
  battle_deck: "Battle Deck",
  other: "Other sealed",
};

export const SET_CATALOG: Array<{ code: string; label: string; match: RegExp }> = [
  { code: "me5", label: "Pitch Black", match: /\bpitch\s*black\b/i },
  { code: "me4", label: "Chaos Rising", match: /\bchaos\s*rising\b/i },
  { code: "me3", label: "Perfect Order", match: /\bperfect\s*order\b/i },
  { code: "me2pt5", label: "Ascended Heroes", match: /\bascended\s*heroes\b/i },
  { code: "me2", label: "Phantasmal Flames", match: /\bphantasmal\s*flames\b/i },
  { code: "me1", label: "Mega Evolution", match: /\bmega\s*evolution\b(?!\s*—|\s*-\s*pitch|\s*-\s*chaos)/i },
  { code: "zsv10pt5", label: "Black Bolt", match: /\bblack\s*bolt\b/i },
  { code: "rsv10pt5", label: "White Flare", match: /\bwhite\s*flare\b/i },
  { code: "sv10", label: "Destined Rivals", match: /\bdestined\s*rivals\b/i },
  { code: "sv9", label: "Journey Together", match: /\bjourney\s*together\b/i },
  { code: "sv8pt5", label: "Prismatic Evolutions", match: /\bprismatic\b/i },
  { code: "sv8", label: "Surging Sparks", match: /\bsurging\s*sparks\b/i },
  { code: "sv7", label: "Stellar Crown", match: /\bstellar\s*crown\b/i },
  { code: "sv6pt5", label: "Shrouded Fable", match: /\bshrouded\s*fable\b/i },
  { code: "sv6", label: "Twilight Masquerade", match: /\btwilight\s*masquerade\b/i },
  { code: "sv5", label: "Temporal Forces", match: /\btemporal\s*forces\b/i },
  { code: "sv4pt5", label: "Paldean Fates", match: /\bpaldean\s*fates\b/i },
  { code: "sv4", label: "Paradox Rift", match: /\bparadox\s*rift\b/i },
  { code: "sv3pt5", label: "151", match: /\b151\b|\bscarlet.*violet.*151\b/i },
  { code: "sv3", label: "Obsidian Flames", match: /\bobsidian\s*flames\b/i },
  { code: "sv2", label: "Paldea Evolved", match: /\bpaldea\s*evolved\b/i },
  { code: "sv1", label: "Scarlet & Violet", match: /\bscarlet\s*(&|and)\s*violet\b(?!\s*151)/i },
  { code: "swsh12pt5", label: "Crown Zenith", match: /\bcrown\s*zenith\b/i },
  { code: "celebrations", label: "Celebrations", match: /\bcelebrations\b/i },
];

const SEALED_PRODUCT_RE =
  /\b(etb|elite\s*trainer\s*box|booster\s*box|booster\s*bundle|booster\s*display|blister|3-?\s*pack|collection\s*box|upc|ultra\s*premium|tin|battle\s*deck|build\s*(&|and)\s*battle|poster\s*collection|tech\s*sticker|illustration\s*collection|premium\s*collection|special\s*collection|ex\s*box|trainer\s*box)\b/i;

const JUNK_PRODUCT_RE =
  /\b(handbook|guide\s*book|album|portfolio|binder|sleeve|sleeves|board\s*game|guessing|plush|figure|hot\s*wheels|matchbox|diecast|pin\b|apparel|t-?shirt|hoodie|poster(?!\s*collection)|sticker(?!\s*collection)|coin(?!\s*flip)|keychain|mug|toy\s*car|die-?cast)\b/i;

export function looksLikeSealedProduct(name: string): boolean {
  if (!name) return false;
  if (JUNK_PRODUCT_RE.test(name)) return false;
  if (/\bebay\b/i.test(name)) return false;
  return SEALED_PRODUCT_RE.test(name);
}

/** Core packs/boxes users actually care about for stock hunting. */
export function isCorePackOrBox(name: string, category?: ProductCategory | string | null): boolean {
  if (JUNK_PRODUCT_RE.test(name)) return false;
  if (category && ["etb", "booster_bundle", "booster_box", "tin", "collection", "battle_deck"].includes(category)) {
    return !JUNK_PRODUCT_RE.test(name);
  }
  return looksLikeSealedProduct(name);
}

export function inferCategory(name: string): ProductCategory {
  const n = name.toLowerCase();
  if (/\belite\s*trainer|\betb\b/.test(n)) return "etb";
  if (/\bbooster\s*bundle\b/.test(n)) return "booster_bundle";
  if (/\bbooster\s*box\b|\bbooster\s*display\b/.test(n)) return "booster_box";
  if (/\bbattle\s*deck\b|\bbuild\s*(&|and)\s*battle\b/.test(n)) return "battle_deck";
  if (/\btin\b/.test(n)) return "tin";
  if (
    /\b(collection|upc|ultra\s*premium|poster\s*collection|illustration|tech\s*sticker|premium\s*collection|ex\s*box)\b/.test(
      n,
    )
  ) {
    return "collection";
  }
  return "other";
}

export function inferSet(name: string): { code: string; label: string } | null {
  for (const s of SET_CATALOG) {
    if (s.match.test(name)) return { code: s.code, label: s.label };
  }
  return null;
}

export function enrichSignalName(
  productName: string,
  products: TrackedProduct[],
): {
  category: ProductCategory;
  setCode: string | null;
  setLabel: string | null;
  productId: string | null;
  matchedProductName: string | null;
} {
  let best: { product: TrackedProduct; score: number } | null = null;
  const n = productName.toLowerCase();
  for (const p of products) {
    const tokens = p.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !["the", "and", "box", "pokemon", "pokémon"].includes(t));
    const hits = tokens.filter((t) => n.includes(t)).length;
    const score = hits / Math.max(tokens.length, 1);
    if (hits >= 2 && score >= 0.5) {
      if (!best || score > best.score) best = { product: p, score };
    }
  }
  const fromTracked = best?.product;
  const set = inferSet(productName);
  const category = fromTracked
    ? (fromTracked.category as ProductCategory)
    : inferCategory(productName);

  return {
    category,
    setCode: fromTracked?.setCode || set?.code || null,
    setLabel:
      fromTracked
        ? SET_CATALOG.find((s) => s.code === fromTracked.setCode)?.label || fromTracked.setCode
        : set?.label || null,
    productId: fromTracked?.id || null,
    matchedProductName: fromTracked?.name || null,
  };
}

export function categoryOptions(): Array<{ id: ProductCategory | "all"; label: string }> {
  return [
    { id: "all", label: "All pack types" },
    ...Object.entries(CATEGORY_LABELS)
      .filter(([id]) => id !== "other")
      .map(([id, label]) => ({
        id: id as ProductCategory,
        label,
      })),
  ];
}

export function unwrapAffiliateUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Skimlinks / similar wrappers
    if (u.hostname.includes("skimresources") || u.hostname.includes("go.skim")) {
      const inner = u.searchParams.get("url");
      if (inner) return unwrapAffiliateUrl(decodeURIComponent(inner));
    }
    // Reject opaque deep-link shorteners that often misroute
    if (
      /mavely\.app\.link|bit\.ly|tinyurl\.com|t\.co|app\.link/i.test(u.hostname)
    ) {
      return null;
    }
    if (/ebay\./i.test(u.hostname)) return null;
    // Amazon/marketplace markup — not MSRP
    if (/amazon\./i.test(u.hostname)) return null;
    if (/target\.com/i.test(u.hostname)) {
      return `${u.origin}${u.pathname}`;
    }
    if (/walmart\.com|bestbuy\.com|gamestop\.com|pokemoncenter\.com/i.test(u.hostname)) {
      return `${u.origin}${u.pathname}${u.search || ""}`.replace(/[?&](tag|linkCode|ref)=[^&]*/g, "");
    }
    return null;
  } catch {
    return null;
  }
}

export function searchUrlForRetailer(retailer: RetailerSlug | null, productName: string): string | null {
  if (!retailer || !productName || !isMsrpRetailer(retailer)) return null;
  const q = encodeURIComponent(`Pokemon TCG ${productName}`);
  switch (retailer) {
    case "target":
      return `https://www.target.com/s?searchTerm=${q}`;
    case "walmart":
      return `https://www.walmart.com/search?q=${q}`;
    case "best-buy":
      return `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`;
    case "gamestop":
      return `https://www.gamestop.com/search/?q=${q}`;
    case "pokemon-center":
      return `https://www.pokemoncenter.com/search/${encodeURIComponent(productName)}`;
    default:
      return null;
  }
}

export function resolveProductUrl(opts: {
  hrefs: string[];
  retailerSlug: RetailerSlug | null;
  productId: string | null;
  productName: string;
  products: TrackedProduct[];
}): string | null {
  if (opts.productId) {
    const p = opts.products.find((x) => x.id === opts.productId);
    const slug = opts.retailerSlug;
    if (p && slug && p.retailerUrls[slug]) return p.retailerUrls[slug]!;
  }
  for (const href of opts.hrefs) {
    const clean = unwrapAffiliateUrl(href);
    if (!clean) continue;
    if (
      /target\.com|walmart\.com|bestbuy\.com|gamestop\.com|pokemoncenter\.com/i.test(
        clean,
      )
    ) {
      return clean;
    }
  }
  return searchUrlForRetailer(opts.retailerSlug, opts.productName);
}
