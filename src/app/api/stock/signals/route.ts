import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import {
  CATEGORY_LABELS,
  enrichSignalName,
  looksLikeSealedProduct,
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
  const limit = Math.min(Number(searchParams.get("limit") || 200), 400);

  const store = await readStore();
  const products = store.products || [];

  let signals: EnrichedWebSignal[] = (store.webSignals || []).map((s) => {
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

  // Default: focus on sealed product listings from retailer sites (drop noisy forum posts)
  if (sealedOnly) {
    signals = signals.filter(
      (s) =>
        looksLikeSealedProduct(s.productName) ||
        Boolean(s.productId) ||
        s.sourceSite === "nowinstock.net",
    );
    // Drop obvious non-product Reddit chatter
    signals = signals.filter((s) => {
      if (!s.sourceSite.includes("reddit")) return true;
      return looksLikeSealedProduct(s.productName) || Boolean(s.matchedProductName);
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
    })
    .slice(0, limit);

  // Facets from full enriched pool (pre slice, post sealed filter)
  const facetPool: EnrichedWebSignal[] = (store.webSignals || [])
    .map((s) => {
      const meta = enrichSignalName(s.productName, products);
      return {
        ...s,
        productId: s.productId || meta.productId,
        category: meta.category,
        setCode: meta.setCode,
        setLabel: meta.setLabel,
        matchedProductName: meta.matchedProductName,
      };
    })
    .filter((s) => {
      if (!sealedOnly) return true;
      if (s.sourceSite.includes("reddit")) {
        return looksLikeSealedProduct(s.productName) || Boolean(s.matchedProductName);
      }
      return looksLikeSealedProduct(s.productName) || Boolean(s.productId) || s.sourceSite === "nowinstock.net";
    });

  const setMap = new Map<string, string>();
  const catSet = new Set<ProductCategory>();
  const retailerSet = new Set<string>();
  for (const s of facetPool) {
    if (s.setCode && s.setLabel) setMap.set(s.setCode, s.setLabel);
    catSet.add(s.category);
    if (s.retailerSlug) retailerSet.add(s.retailerSlug);
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
      retailers: [...retailerSet].sort(),
      sources: [...new Set(facetPool.map((s) => s.sourceSite))].sort(),
    },
    meta: {
      webSignalsSyncedAt: store.meta.webSignalsSyncedAt ?? null,
      stockPolledAt: store.meta.stockPolledAt,
      total: signals.length,
      pool: facetPool.length,
      inStock: facetPool.filter((s) => s.status === "in_stock" || s.status === "limited").length,
    },
  });
}
