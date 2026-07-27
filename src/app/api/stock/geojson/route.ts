import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { buildMapViews, statusColor } from "@/lib/stock-logic";

export const dynamic = "force-dynamic";

/** Lightweight GeoJSON for MapLibre clustering (thousands of points). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const retailer = searchParams.get("retailer");
  const inStockOnly = searchParams.get("inStock") === "1";

  const store = await readStore();
  let views = buildMapViews(
    store.locations,
    store.retailers,
    store.snapshots,
    store.reports,
    productId,
  );

  if (retailer) views = views.filter((v) => v.retailer.slug === retailer);
  if (inStockOnly) {
    views = views.filter(
      (v) => v.effectiveStatus === "in_stock" || v.effectiveStatus === "limited",
    );
  }

  const features = views.map((v) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [v.location.lng, v.location.lat],
    },
    properties: {
      id: v.location.id,
      name: v.location.name,
      retailer: v.retailer.name,
      retailerSlug: v.retailer.slug,
      retailerColor: v.retailer.color,
      type: v.location.type,
      status: v.effectiveStatus,
      color: statusColor(v.effectiveStatus),
      source: v.source,
      freshness: v.freshnessLabel,
      confidence: Number(v.confidence.toFixed(2)),
      address: `${v.location.address}, ${v.location.city}, ${v.location.state}`.replace(/^, |, $/g, ""),
      city: v.location.city,
      state: v.location.state,
    },
  }));

  return NextResponse.json({
    type: "FeatureCollection",
    features,
    meta: {
      ...store.meta,
      count: features.length,
      products: store.products,
      retailers: store.retailers,
      recentSignals: (store.webSignals || [])
        .filter((s) => s.status === "in_stock" || s.status === "limited")
        .slice(0, 12),
      signalCount: store.webSignals?.length || 0,
    },
  });
}
