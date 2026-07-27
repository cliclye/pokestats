import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { buildMapViews } from "@/lib/stock-logic";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const store = await readStore();
  const location = store.locations.find((l) => l.id === id);
  if (!location) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const views = buildMapViews(
    [location],
    store.retailers,
    store.snapshots,
    store.reports,
    productId,
  );
  return NextResponse.json({
    view: views[0],
    products: store.products,
  });
}
