import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { buildMapViews } from "@/lib/stock-logic";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const retailer = searchParams.get("retailer");
  const inStockOnly = searchParams.get("inStock") === "1";
  const status = searchParams.get("status");

  const store = await readStore();
  let views = buildMapViews(
    store.locations,
    store.retailers,
    store.snapshots,
    store.reports,
    productId,
  );

  if (retailer) {
    views = views.filter((v) => v.retailer.slug === retailer);
  }
  if (inStockOnly) {
    views = views.filter((v) => v.effectiveStatus === "in_stock" || v.effectiveStatus === "limited");
  }
  if (status) {
    views = views.filter((v) => v.effectiveStatus === status);
  }

  return NextResponse.json({
    views,
    products: store.products,
    retailers: store.retailers,
    meta: store.meta,
  });
}
