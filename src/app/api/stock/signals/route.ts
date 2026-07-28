import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import {
  CATEGORY_LABELS,
  enrichSignalName,
  isCorePackOrBox,
  isMsrpRetailer,
  looksLikeSealedProduct,
  MSRP_RETAILERS,
  unwrapAffiliateUrl,
  type ProductCategory,
} from "@/lib/stock/product-taxonomy";
import type { StockStatus, WebStockSignal } from "@/lib/types";

export const dynamic = "force-dynamic";

export type EnrichedWebSignal = WebStockSignal & {
  category: ProductCategory;
  setCode: string | null;
  setLabel: string | null;
  matchedProductName: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as StockStatus | null;
  const retailer = searchParams.get("retailer");
  const category = searchParams.get("category") as ProductCategory | "all" | null;
  const setCode = searchParams.get("set");
  const productId = searchParams.get("productId");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const source = searchParams.get("source"); // e.g. nowinstock.net
  const sealedOnly = searchParams.get("sealed") !== "0";
  // Default on: only MSRP big-box / official channels (no Amazon/eBay markup)
  const msrpOnly = searchParams.get("msrp") !== "0";
  const limit = Math.min(Number(searchParams.get("limit") || 200), 400);

  const store = await readStore();
  const products = store.products || [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const retailerById = new Map(store.retailers.map((r) => [r.id, r]));

  const fromWeb: EnrichedWebSignal[] = (store.webSignals || []).map((s) => {
    const meta = enrichSignalName(s.productName, products);
    return {
      ...s,
      productId: s.productId || meta.productId,
      category: meta.category,
      setCode: meta.setCode,
      setLabel: meta.setLabel,
      matchedProductName: meta.matchedProductName,
    };
  });

  // Automatic direct retailer polls (no community form needed)
  const fromPolls: EnrichedWebSignal[] = (store.snapshots || [])
    .filter((s) => s.source === "online_poll" && s.status !== "unknown")
    .map((s) => {
      const product = productById.get(s.productId);
      const retailer = retailerById.get(s.retailerId);
      const name = product?.name || s.note || s.productId;
      const meta = enrichSignalName(name, products);
      const slug = retailer?.slug || null;
      const url =
        (slug && product?.retailerUrls?.[slug as keyof typeof product.retailerUrls]) ||
        null;
      return {
        id: s.id,
        sourceSite: "auto-poll",
        title: `${name} — ${slug || "retailer"} ${s.status}`,
        url,
        retailerSlug: slug,
        productId: s.productId,
        productName: name,
        status: s.status,
        observedAt: s.checkedAt,
        raw: s.note || "online_poll",
        category: (product?.category as ProductCategory) || meta.category,
        setCode: product?.setCode || meta.setCode,
        setLabel: meta.setLabel,
        matchedProductName: product?.name || meta.matchedProductName,
      };
    });

  let signals: EnrichedWebSignal[] = [...fromPolls, ...fromWeb]
    .map((s) => ({
      ...s,
      url: unwrapAffiliateUrl(s.url) || (isMsrpRetailer(s.retailerSlug) ? s.url : null),
    }))
    // Drop opaque / junk links that previously sent users to unrelated pages
    .filter((s) => {
      if (!s.url) return true;
      if (/mavely\.app\.link|bit\.ly|tinyurl|ebay\.|amazon\./i.test(s.url)) return false;
      return true;
    });

  // MSRP-only: Target / Walmart / Best Buy / GameStop / Pokémon Center
  if (msrpOnly) {
    signals = signals.filter((s) => isMsrpRetailer(s.retailerSlug));
  }

  // Default: only core sealed packs/boxes (ETB, booster, tin, collection) — no albums/handbooks/toys
  if (sealedOnly) {
    signals = signals.filter((s) => {
      if (s.sourceSite.includes("reddit")) return false;
      if (s.sourceSite === "auto-poll") {
        return isCorePackOrBox(s.productName, s.category);
      }
      return isCorePackOrBox(s.productName, s.category) || looksLikeSealedProduct(s.productName);
    });
  }

  if (status) signals = signals.filter((s) => s.status === status);
  if (retailer) signals = signals.filter((s) => s.retailerSlug === retailer);
  if (category && category !== "all") {
    signals = signals.filter((s) => s.category === category);
  }
  if (setCode) signals = signals.filter((s) => s.setCode === setCode);
  if (productId) {
    const product = products.find((p) => p.id === productId);
    signals = signals.filter((s) => {
      if (s.productId === productId) return true;
      if (!product) return false;
      const n = s.productName.toLowerCase();
      return product.name
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3)
        .every((t) => n.includes(t));
    });
  }
  if (source) signals = signals.filter((s) => s.sourceSite.includes(source));
  if (q) {
    signals = signals.filter((s) => {
      const hay = `${s.productName} ${s.title} ${s.setLabel || ""} ${s.retailerSlug || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  signals = signals
    .sort((a, b) => {
      const rank = (st: StockStatus) =>
        st === "in_stock" ? 0 : st === "limited" ? 1 : st === "out" ? 2 : 3;
      const rd = rank(a.status) - rank(b.status);
      if (rd !== 0) return rd;
      return b.observedAt.localeCompare(a.observedAt);
    });

  // Collapse duplicate product+retailer+status rows (auto-poll + scrape overlap)
  const seen = new Set<string>();
  signals = signals.filter((s) => {
    const key = `${s.productName.toLowerCase()}|${s.retailerSlug}|${s.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  // Facets from full enriched pool (pre slice, post sealed filter)
  const facetPool: EnrichedWebSignal[] = [...fromPolls, ...fromWeb]
    .map((s) => ({
      ...s,
      url: unwrapAffiliateUrl(s.url) || s.url,
    }))
    .filter((s) => {
      if (msrpOnly && !isMsrpRetailer(s.retailerSlug)) return false;
      if (!sealedOnly) return true;
      if (s.sourceSite.includes("reddit")) return false;
      if (s.url && /mavely\.app\.link|ebay\.|amazon\./i.test(s.url)) return false;
      return isCorePackOrBox(s.productName, s.category) || looksLikeSealedProduct(s.productName);
    });

  const setMap = new Map<string, string>();
  const catSet = new Set<ProductCategory>();
  const retailerSet = new Set<string>();
  for (const s of facetPool) {
    if (s.setCode && s.setLabel) setMap.set(s.setCode, s.setLabel);
    catSet.add(s.category);
    if (s.retailerSlug && isMsrpRetailer(s.retailerSlug)) retailerSet.add(s.retailerSlug);
  }

  return NextResponse.json({
    signals,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      setCode: p.setCode,
      category: p.category,
      retailerUrls: p.retailerUrls,
    })),
    facets: {
      categories: [...catSet].map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
      })),
      sets: [...setMap.entries()]
        .map(([code, label]) => ({ code, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      retailers: msrpOnly
        ? [...MSRP_RETAILERS]
        : [...retailerSet].sort(),
      sources: [...new Set(facetPool.map((s) => s.sourceSite))].sort(),
      msrpOnly,
    },
    meta: {
      webSignalsSyncedAt: store.meta.webSignalsSyncedAt ?? null,
      stockPolledAt: store.meta.stockPolledAt,
      total: signals.length,
      pool: facetPool.length,
      inStock: facetPool.filter((s) => s.status === "in_stock" || s.status === "limited")
        .length,
      autoCheck:
        "MSRP retailers only (Target, Walmart, Best Buy, GameStop, Pokémon Center). Amazon/eBay and other markup marketplaces are excluded.",
    },
  });
}
