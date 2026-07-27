import type { TrackedProduct } from "../types";

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
  { code: "me1", label: "Mega Evolution", match: /\bmega\s*evolution\b|\bperfect\s*order\b/i },
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
  { code: "swsh12", label: "Silver Tempest", match: /\bsilver\s*tempest\b/i },
  { code: "swsh11", label: "Lost Origin", match: /\blost\s*origin\b/i },
  { code: "swsh10", label: "Astral Radiance", match: /\bastral\s*radiance\b/i },
  { code: "swsh9", label: "Brilliant Stars", match: /\bbrilliant\s*stars\b/i },
  { code: "swsh8", label: "Fusion Strike", match: /\bfusion\s*strike\b/i },
  { code: "swsh7", label: "Evolving Skies", match: /\bevolving\s*skies\b/i },
  { code: "celebrations", label: "Celebrations", match: /\bcelebrations\b/i },
];

const SEALED_PRODUCT_RE =
  /\b(etb|elite\s*trainer|booster\s*box|booster\s*bundle|booster\s*pack|collection\s*box|upc|ultra\?\s*premium|tin|battle\s*deck|build\s*(&|and)\s*battle|poster\s*collection|tech\s*sticker|illustration\s*collection|premium\s*collection|special\s*collection)\b/i;

export function looksLikeSealedProduct(name: string): boolean {
  return SEALED_PRODUCT_RE.test(name);
}

export function inferCategory(name: string): ProductCategory {
  const n = name.toLowerCase();
  if (/\belite\s*trainer|\betb\b/.test(n)) return "etb";
  if (/\bbooster\s*bundle\b/.test(n)) return "booster_bundle";
  if (/\bbooster\s*box\b/.test(n)) return "booster_box";
  if (/\bbattle\s*deck\b|\bbuild\s*(&|and)\s*battle\b/.test(n)) return "battle_deck";
  if (/\btin\b/.test(n)) return "tin";
  if (
    /\b(collection|upc|ultra\s*premium|poster|illustration|tech\s*sticker|premium\s*collection)\b/.test(
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
  const matched = products.find((p) =>
    productName.toLowerCase().includes(
      p.name.toLowerCase().replace(/\s+/g, " ").slice(0, 24),
    ),
  );
  const fromTracked = products.find((p) => p.id === matched?.id);
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
    { id: "all", label: "All types" },
    ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
      id: id as ProductCategory,
      label,
    })),
  ];
}
